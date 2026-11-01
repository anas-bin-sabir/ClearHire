from functools import lru_cache
from typing import List, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Mirrors app.db.url.SSL_MODES (not imported: app.db imports this module).
DB_SSL_MODES = ("disable", "allow", "prefer", "require", "verify-ca", "verify-full")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="ClearHire API", alias="APP_NAME")
    debug: bool = Field(default=False, alias="DEBUG")
    secret_key: str = Field(default="dev-secret-key-change-me", alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(
        default=60 * 24, alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    cors_origins: str = Field(
        default=(
            "http://localhost:3000,http://127.0.0.1:3000,"
            "http://localhost:5173,http://127.0.0.1:5173"
        ),
        alias="CORS_ORIGINS",
    )
    cors_origin_regex: str | None = Field(
        default=r"http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?",
        alias="CORS_ORIGIN_REGEX",
    )

    database_url: str = Field(
        default="postgresql+asyncpg://clearhire:clearhire123@localhost:5432/clearhire_db",
        alias="DATABASE_URL",
    )
    auto_migrate: bool = Field(default=True, alias="AUTO_MIGRATE")
    db_null_pool: bool = Field(default=False, alias="DB_NULL_POOL")
    seed_enabled: bool = Field(default=True, alias="SEED_ENABLED")
    # libpq-style sslmode (disable/allow/prefer/require/verify-ca/verify-full). Empty =
    # use ?sslmode= from DATABASE_URL, else "require" for Supabase hosts, else no SSL.
    db_ssl_mode: str = Field(default="", alias="DB_SSL_MODE")
    db_pool_size: int = Field(default=5, ge=1, alias="DB_POOL_SIZE")
    db_max_overflow: int = Field(default=5, ge=0, alias="DB_MAX_OVERFLOW")
    # asyncpg statement cache; 0 is required behind a transaction pooler (Supabase :6543).
    # Unset = asyncpg default, or 0 automatically when DATABASE_URL uses port 6543.
    db_statement_cache_size: int | None = Field(
        default=None, ge=0, alias="DB_STATEMENT_CACHE_SIZE"
    )

    # Neo4j graph read model (derived from Postgres; optional). Unset NEO4J_URI
    # disables it and graph features fall back to recursive CTEs in Postgres.
    neo4j_uri: str = Field(default="", alias="NEO4J_URI")
    neo4j_user: str = Field(default="neo4j", alias="NEO4J_USER")
    neo4j_password: str = Field(default="", alias="NEO4J_PASSWORD")
    neo4j_database: str = Field(default="neo4j", alias="NEO4J_DATABASE")
    # GraphRAG skill expansion: hops over RELATED_TO, weight multiplied per extra hop.
    graph_expansion_hops: int = Field(default=2, ge=1, le=3, alias="GRAPH_EXPANSION_HOPS")
    graph_expansion_decay: float = Field(
        default=0.5, gt=0.0, le=1.0, alias="GRAPH_EXPANSION_DECAY"
    )
    # Outbox drain interval for Postgres -> Neo4j sync.
    graph_sync_interval_seconds: float = Field(
        default=2.0, gt=0.0, alias="GRAPH_SYNC_INTERVAL_SECONDS"
    )

    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(default="claude-haiku-5-5", alias="ANTHROPIC_MODEL")
    anthropic_timeout_seconds: float = Field(default=60.0, alias="ANTHROPIC_TIMEOUT_SECONDS")
    skill_grounding_min_similarity: float = Field(
        default=0.72, alias="SKILL_GROUNDING_MIN_SIMILARITY"
    )

    embedding_dimensions: int = Field(default=384, alias="EMBEDDING_DIMENSIONS")
    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2", alias="EMBEDDING_MODEL"
    )
    embedding_provider: str = Field(default="local", alias="EMBEDDING_PROVIDER")
    # Where fastembed keeps the ONNX model; unset uses fastembed's temp-dir default.
    embedding_cache_dir: str = Field(default="", alias="EMBEDDING_CACHE_DIR")

    # LLM rerank of the top of the shortlist (falls back to deterministic reasoning).
    rerank_enabled: bool = Field(default=True, alias="RERANK_ENABLED")
    rerank_top_n: int = Field(default=10, ge=1, le=25, alias="RERANK_TOP_N")
    # final = alpha * deterministic + (1 - alpha) * llm_fit
    rerank_alpha: float = Field(default=0.6, ge=0.0, le=1.0, alias="RERANK_ALPHA")
    rerank_effort: Literal["low", "medium", "high"] = Field(default="low", alias="RERANK_EFFORT")

    # Weight of the full-text channel relative to the vector channel in RRF fusion.
    search_keyword_rrf_weight: float = Field(default=0.5, alias="SEARCH_KEYWORD_RRF_WEIGHT")

    # Tuned on the dev queries of scripts/eval_retrieval.py (see docs/EVAL.md).
    rank_semantic: float = Field(default=0.48, alias="RANK_WEIGHT_SEMANTIC")
    rank_keyword: float = Field(default=0.12, alias="RANK_WEIGHT_KEYWORD")
    rank_skill: float = Field(default=0.12, alias="RANK_WEIGHT_SKILL")
    rank_experience: float = Field(default=0.08, alias="RANK_WEIGHT_EXPERIENCE")
    rank_rating: float = Field(default=0.04, alias="RANK_WEIGHT_RATING")
    rank_budget: float = Field(default=0.08, alias="RANK_WEIGHT_BUDGET")
    rank_availability: float = Field(default=0.04, alias="RANK_WEIGHT_AVAILABILITY")
    rank_fraud: float = Field(default=0.04, alias="RANK_WEIGHT_FRAUD")

    rate_limit_enabled: bool = Field(default=True, alias="RATE_LIMIT_ENABLED")
    rate_limit_public_max_requests: int = Field(
        default=60, alias="RATE_LIMIT_PUBLIC_MAX_REQUESTS"
    )
    rate_limit_public_window_seconds: int = Field(
        default=60, alias="RATE_LIMIT_PUBLIC_WINDOW_SECONDS"
    )
    rate_limit_user_max_requests: int = Field(
        default=300, alias="RATE_LIMIT_USER_MAX_REQUESTS"
    )
    rate_limit_user_window_seconds: int = Field(
        default=60, alias="RATE_LIMIT_USER_WINDOW_SECONDS"
    )
    rate_limit_auth_free_attempts: int = Field(
        default=3, alias="RATE_LIMIT_AUTH_FREE_ATTEMPTS"
    )
    rate_limit_auth_backoff_base_seconds: float = Field(
        default=1.0, alias="RATE_LIMIT_AUTH_BACKOFF_BASE_SECONDS"
    )
    rate_limit_auth_backoff_multiplier: float = Field(
        default=2.0, alias="RATE_LIMIT_AUTH_BACKOFF_MULTIPLIER"
    )
    rate_limit_auth_backoff_max_seconds: float = Field(
        default=300.0, alias="RATE_LIMIT_AUTH_BACKOFF_MAX_SECONDS"
    )

    @field_validator("db_ssl_mode", mode="before")
    @classmethod
    def _validate_ssl_mode(cls, value: object) -> str:
        mode = "" if value is None else str(value).strip().lower()
        if mode and mode not in DB_SSL_MODES:
            raise ValueError(f"DB_SSL_MODE must be one of {', '.join(DB_SSL_MODES)}")
        return mode

    @field_validator("db_statement_cache_size", mode="before")
    @classmethod
    def _empty_cache_size_is_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
