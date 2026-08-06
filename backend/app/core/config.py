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
    debug: bool = Field(default=True, alias="DEBUG")
    secret_key: str = Field(default="dev-secret-key", alias="SECRET_KEY")
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
        default="postgresql+asyncpg://clearhire:clearhire123@localhost:5435/clearhire_db",
        alias="DATABASE_URL",
    )

    mongodb_url: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URL")
    mongodb_db: str = Field(default="clearhire", alias="MONGODB_DB")

    neo4j_uri: str = Field(default="bolt://localhost:7687", alias="NEO4J_URI")
    neo4j_user: str = Field(default="neo4j", alias="NEO4J_USER")
    neo4j_password: str = Field(default="clearhire123", alias="NEO4J_PASSWORD")

    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(
        default="claude-3-5-haiku-latest",
        alias="ANTHROPIC_MODEL",
    )

    embedding_dimensions: int = Field(default=384, alias="EMBEDDING_DIMENSIONS")

    # --- Rate limiting ---
    rate_limit_enabled: bool = Field(default=True, alias="RATE_LIMIT_ENABLED")

    # Moderate limits for public/read-heavy endpoints (search, graph, stats, list views, ...)
    rate_limit_public_max_requests: int = Field(
        default=60, alias="RATE_LIMIT_PUBLIC_MAX_REQUESTS"
    )
    rate_limit_public_window_seconds: int = Field(
        default=60, alias="RATE_LIMIT_PUBLIC_WINDOW_SECONDS"
    )

    # Looser limits for authenticated-user actions (create/update freelancers,
    # projects, contracts, team builds, settings, ...)
    rate_limit_user_max_requests: int = Field(
        default=300, alias="RATE_LIMIT_USER_MAX_REQUESTS"
    )
    rate_limit_user_window_seconds: int = Field(
        default=60, alias="RATE_LIMIT_USER_WINDOW_SECONDS"
    )

    # Strict limits for /auth/login and /auth/signup: combined per-IP and
    # per-account exponential backoff instead of a hard lockout.
    rate_limit_auth_free_attempts: int = Field(
        default=3,
        alias="RATE_LIMIT_AUTH_FREE_ATTEMPTS",
        description="Failed attempts allowed before backoff delay kicks in",
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
