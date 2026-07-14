from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
