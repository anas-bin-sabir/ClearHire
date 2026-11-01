from dataclasses import dataclass

from sqlalchemy import String, bindparam, delete, select, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import embed_text, embed_texts
from app.ai.skill_taxonomy import (
    RELATED_SKILLS,
    TAXONOMY,
    SkillDef,
    category_edges,
    lookup,
    related_skill_map,
)
from app.core.config import settings
from app.models.orm import Skill, SkillRelationship


class SkillRelationshipRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_all(self) -> list[SkillRelationship]:
        result = await self._session.execute(select(SkillRelationship))
        return list(result.scalars().all())

    async def upsert_pair(self, skill_a: str, skill_b: str, weight: float = 0.5) -> None:
        stmt = insert(SkillRelationship).values(skill_a=skill_a, skill_b=skill_b, weight=weight)
        stmt = stmt.on_conflict_do_update(
            index_elements=["skill_a", "skill_b"], set_={"weight": stmt.excluded.weight}
        )
        await self._session.execute(stmt)

    async def _upsert_many(self, edges: list[tuple[str, str, float]]) -> None:
        if not edges:
            return
        stmt = insert(SkillRelationship).values(
            [{"skill_a": a, "skill_b": b, "weight": w} for a, b, w in edges]
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["skill_a", "skill_b"], set_={"weight": stmt.excluded.weight}
        )
        await self._session.execute(stmt)

    async def sync_curated(self) -> int:
        """Upsert the curated adjacency list from app.ai.skill_taxonomy (no pruning)."""
        await self._upsert_many(list(RELATED_SKILLS))
        return len(RELATED_SKILLS)

    async def sync_ontology(self, *, include_category_edges: bool) -> int:
        """Make the table mirror the ontology: curated + category-derived edges.

        Category edges are computed from the embeddings stored in ``skills`` (see
        ``skill_taxonomy.category_edges``) and never override a curated pair. Rows
        that are not part of the ontology (stale category edges, reversed duplicates
        of a curated pair) are deleted, so re-running is idempotent. Returns the
        number of edges in the table afterwards.
        """
        edges = list(RELATED_SKILLS)
        if include_category_edges:
            rows = await self._session.execute(
                select(Skill.name, Skill.category, Skill.embedding).where(
                    Skill.embedding.is_not(None)
                )
            )
            vectors = {
                name: (category, [float(x) for x in embedding])
                for name, category, embedding in rows.all()
            }
            edges += category_edges(vectors)
        await self._upsert_many(edges)
        prune = text(
            """
            DELETE FROM skill_relationships r
            WHERE NOT EXISTS (
                SELECT 1 FROM unnest(:a, :b) AS k(a, b)
                WHERE k.a = r.skill_a AND k.b = r.skill_b
            )
            """
        ).bindparams(bindparam("a", type_=ARRAY(String)), bindparam("b", type_=ARRAY(String)))
        await self._session.execute(
            prune, {"a": [e[0] for e in edges], "b": [e[1] for e in edges]}
        )
        return len(edges)

    async def adjacency(self) -> dict[str, dict[str, float]]:
        """Symmetric {skill_lower: {related_lower: weight}} map for ranking."""
        rows = await self.list_all()
        return related_skill_map([(r.skill_a, r.skill_b, r.weight) for r in rows])

    async def delete_all(self) -> None:
        await self._session.execute(delete(SkillRelationship))


@dataclass
class GroundedSkill:
    input: str
    canonical: str | None
    importance: str
    match: str  # exact | alias | semantic | none
    confidence: float
    category: str | None


def _skill_embedding_text(skill: SkillDef) -> str:
    aliases = ", ".join(skill.aliases)
    return f"{skill.name} ({skill.category})" + (f": {aliases}" if aliases else "")


def _hash_embeddings() -> bool:
    return (settings.embedding_provider or "local").lower() in {"hash", "test"}


class SkillRepository:
    """Canonical skill taxonomy stored with embeddings for semantic grounding."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def sync_taxonomy(self) -> int:
        """Upsert app.ai.skill_taxonomy into the table; embed rows that need it."""
        existing = {
            row.name: row for row in (await self._session.execute(select(Skill))).scalars()
        }
        to_embed: list[tuple[Skill, SkillDef]] = []
        for definition in TAXONOMY:
            row = existing.get(definition.name)
            if row is None:
                row = Skill(name=definition.name, category=definition.category)
                self._session.add(row)
            changed = row.category != definition.category or list(row.aliases or []) != list(
                definition.aliases
            )
            row.category = definition.category
            row.aliases = list(definition.aliases)
            if row.embedding is None or changed:
                to_embed.append((row, definition))
        vectors = embed_texts([_skill_embedding_text(d) for _, d in to_embed])
        for (row, _), vector in zip(to_embed, vectors):
            row.embedding = vector
        await self._session.flush()
        # Category edges need real embeddings: with the hash provider (tests) the
        # cosine between skills is noise, so only the curated list is synced there.
        await SkillRelationshipRepository(self._session).sync_ontology(
            include_category_edges=not _hash_embeddings()
        )
        await self._session.flush()
        return len(to_embed)

    async def list_names(self) -> list[str]:
        result = await self._session.execute(select(Skill.name).order_by(Skill.name))
        return list(result.scalars().all())

    async def _nearest(self, text: str) -> tuple[Skill, float] | None:
        distance = Skill.embedding.cosine_distance(embed_text(text))
        result = await self._session.execute(
            select(Skill, distance)
            .where(Skill.embedding.is_not(None))
            .order_by(distance)
            .limit(1)
        )
        row = result.first()
        if row is None:
            return None
        return row[0], max(0.0, min(1.0, 1.0 - float(row[1])))

    async def ground(self, items: list[tuple[str, str]]) -> list[GroundedSkill]:
        """Map (raw skill, importance) pairs onto the taxonomy.

        Exact/alias lookup first; otherwise the nearest skill embedding if it clears
        SKILL_GROUNDING_MIN_SIMILARITY. Duplicates collapse onto the first "must".
        """
        grounded: dict[str, GroundedSkill] = {}
        for raw, importance in items:
            text = raw.strip()
            if not text:
                continue
            found = lookup(text)
            if found:
                skill, match = found
                result = GroundedSkill(
                    text, skill.name, importance, match, 1.0 if match == "exact" else 0.95,
                    skill.category,
                )
            else:
                nearest = await self._nearest(text)
                if nearest and nearest[1] >= settings.skill_grounding_min_similarity:
                    skill_row, similarity = nearest
                    result = GroundedSkill(
                        text, skill_row.name, importance, "semantic", round(similarity, 3),
                        skill_row.category,
                    )
                else:
                    result = GroundedSkill(text, None, importance, "none", 0.0, None)
            key = (result.canonical or text).lower()
            current = grounded.get(key)
            if current is None or (current.importance == "nice" and importance == "must"):
                grounded[key] = result
        return list(grounded.values())
