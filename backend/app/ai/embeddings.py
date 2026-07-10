"""Single embedding service. Vectors are 384-d MiniLM (or a hash stand-in in tests).

The local provider runs all-MiniLM-L6-v2 through fastembed (ONNX Runtime, no PyTorch),
which produces the same normalized vectors sentence-transformers did, so stored
embeddings stay compatible.
"""

from __future__ import annotations

import hashlib
from typing import Iterable

from app.core.config import settings

_model = None


def freelancer_embedding_text(
    *,
    name: str = "",
    bio: str | None = "",
    skills: Iterable[str] | None = None,
    location: str | None = "",
    past_projects: Iterable[str] | None = None,
) -> str:
    skill_part = " ".join(skills or [])
    projects = "; ".join(p for p in (past_projects or []) if p)
    project_part = f"Past projects: {projects}" if projects else ""
    return " ".join(
        part
        for part in (name, bio or "", skill_part, location or "", project_part)
        if part
    ).strip()


def project_embedding_text(
    *,
    title: str | None = "",
    description: str | None = "",
    required_skills: Iterable[str] | None = None,
    constraints: Iterable[str] | None = None,
) -> str:
    skills = " ".join(required_skills or [])
    extra = " ".join(constraints or [])
    return " ".join(
        part
        for part in (title or "", description or "", skills, extra)
        if part
    ).strip()


def _hash_embedding(text: str) -> list[float]:
    dim = settings.embedding_dimensions
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    raw: list[int] = []
    seed = digest
    while len(raw) < dim:
        seed = hashlib.sha256(seed).digest()
        raw.extend(seed)
    values = [(b / 127.5) - 1.0 for b in raw[:dim]]
    norm = sum(v * v for v in values) ** 0.5 or 1.0
    return [v / norm for v in values]


def _provider() -> str:
    provider = (settings.embedding_provider or "local").lower()
    if provider in {"hash", "test"}:
        return "hash"
    if provider != "local":
        raise RuntimeError("Only the local embedding provider is configured")
    return provider


def _local_model():
    global _model
    if _model is None:
        try:
            from fastembed import TextEmbedding
        except ImportError as exc:
            raise RuntimeError("Install fastembed or set EMBEDDING_PROVIDER=hash") from exc
        _model = TextEmbedding(
            settings.embedding_model, cache_dir=settings.embedding_cache_dir or None
        )
    return _model


def warm_up() -> None:
    """Load the model at startup so the first request doesn't pay for it."""
    if _provider() == "local":
        embed_text("warm up")


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch (one model call for the local provider)."""
    if not texts:
        return []
    cleaned = [(t or "").strip() or " " for t in texts]
    if _provider() == "hash":
        return [_hash_embedding(t) for t in cleaned]
    # fastembed L2-normalizes MiniLM output, matching normalize_embeddings=True.
    return [[float(v) for v in vector] for vector in _local_model().embed(cleaned)]


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return float(dot / (na * nb))
