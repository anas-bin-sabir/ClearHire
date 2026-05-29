import numpy as np

from app.core.config import settings
from app.models.orm import Freelancer


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float64)
    vb = np.array(b, dtype=np.float64)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


def random_unit_embedding(dim: int | None = None) -> list[float]:
    """Generate a normalized random vector for seeding pgvector columns."""
    size = dim or settings.embedding_dimensions
    vec = np.random.randn(size).astype(np.float64)
    norm = np.linalg.norm(vec)
    if norm == 0:
        return [0.0] * size
    return (vec / norm).tolist()


def attach_embedding_similarity(
    freelancers: list[Freelancer],
    query_embedding: list[float] | None,
) -> list[dict]:
    from app.db.utils.serializers import freelancer_to_dict

    rows: list[dict] = []
    for f in freelancers:
        data = freelancer_to_dict(f)
        data["embedding_similarity"] = 0.5
        if query_embedding and f.embedding is not None:
            try:
                emb = list(f.embedding)
                if emb:
                    data["embedding_similarity"] = cosine_similarity(
                        query_embedding, emb
                    )
            except (TypeError, ValueError):
                pass
        rows.append(data)
    return rows
