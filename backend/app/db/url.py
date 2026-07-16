"""Database URL normalisation and asyncpg connect_args, shared by the app and Alembic.

Pure functions only (no engine, no I/O) so ``app/db/session.py`` and
``alembic/env.py`` build their engines from exactly the same settings.

Handles hosted Postgres (Supabase) specifics:

* ``postgres://`` / ``postgresql://`` / ``postgresql+psycopg2://`` URLs are rewritten
  to ``postgresql+asyncpg://``.
* libpq-only query params (``sslmode``, ``sslrootcert``) are stripped because asyncpg
  rejects them; ``sslmode`` is translated into asyncpg's ``ssl`` connect argument.
* Supabase hosts default to ``sslmode=require`` when nothing else is configured.
* Port 6543 (Supabase transaction pooler) disables prepared-statement caching, which
  transaction-mode poolers cannot support.
"""

from __future__ import annotations

import ssl as ssl_module
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from sqlalchemy.engine import URL, make_url

ASYNC_DRIVER = "postgresql+asyncpg"
SSL_MODES = ("disable", "allow", "prefer", "require", "verify-ca", "verify-full")
SUPABASE_HOST_SUFFIXES = ("supabase.co", "supabase.com")
TRANSACTION_POOLER_PORT = 6543
# libpq parameters asyncpg does not accept as connect kwargs.
_LIBPQ_ONLY_PARAMS = ("sslmode", "sslrootcert")


@dataclass(frozen=True)
class DatabaseConfig:
    url: URL
    connect_args: dict[str, Any] = field(default_factory=dict)
    ssl_mode: str | None = None
    statement_cache_size: int | None = None
    warnings: tuple[str, ...] = ()

    @property
    def url_string(self) -> str:
        """URL with the password intact, for create_async_engine / Alembic."""
        return self.url.render_as_string(hide_password=False)


def normalize_ssl_mode(value: str | None) -> str | None:
    """Lower-case and validate an sslmode; empty/None means "not configured"."""
    if value is None:
        return None
    value = value.strip().lower()
    if not value:
        return None
    if value not in SSL_MODES:
        raise ValueError(f"Unsupported DB_SSL_MODE {value!r}; expected one of {', '.join(SSL_MODES)}")
    return value


def is_supabase_host(host: str | None) -> bool:
    if not host:
        return False
    host = host.lower().rstrip(".")
    return any(host == s or host.endswith("." + s) for s in SUPABASE_HOST_SUFFIXES)


def normalize_driver(url: URL) -> URL:
    """Force the asyncpg driver for any postgres URL."""
    backend = url.drivername.split("+", 1)[0]
    if backend in ("postgres", "postgresql"):
        return url.set(drivername=ASYNC_DRIVER)
    return url


def build_ssl_arg(ssl_mode: str | None, root_cert: str | None = None) -> Any:
    """Translate an sslmode into asyncpg's ``ssl`` connect argument (None = omit)."""
    if ssl_mode is None or ssl_mode == "disable":
        return None
    if ssl_mode in ("verify-ca", "verify-full"):
        context = ssl_module.create_default_context(cafile=root_cert)
        context.check_hostname = ssl_mode == "verify-full"
        context.verify_mode = ssl_module.CERT_REQUIRED
        return context
    # allow / prefer / require: asyncpg accepts the libpq mode names as strings.
    return ssl_mode


def build_database_config(
    raw_url: str,
    ssl_mode: str | None = None,
    statement_cache_size: int | None = None,
) -> DatabaseConfig:
    """Resolve the engine URL and asyncpg connect_args.

    Precedence for SSL: explicit ``ssl_mode`` (DB_SSL_MODE) > ``?sslmode=`` in the URL
    > ``require`` for Supabase hosts > no SSL.
    """
    url = normalize_driver(make_url(raw_url))
    warnings: list[str] = []

    query = dict(url.query)
    url_ssl_mode = query.get("sslmode")
    if isinstance(url_ssl_mode, tuple):
        url_ssl_mode = url_ssl_mode[-1]
    root_cert = query.get("sslrootcert")
    if isinstance(root_cert, tuple):
        root_cert = root_cert[-1]
    present = [k for k in _LIBPQ_ONLY_PARAMS if k in query]
    if present:
        url = url.difference_update_query(present)

    resolved_ssl = normalize_ssl_mode(ssl_mode) or normalize_ssl_mode(url_ssl_mode)
    if resolved_ssl is None and is_supabase_host(url.host):
        resolved_ssl = "require"

    connect_args: dict[str, Any] = {}
    ssl_arg = build_ssl_arg(resolved_ssl, root_cert or None)
    if ssl_arg is not None:
        connect_args["ssl"] = ssl_arg

    cache_size = statement_cache_size
    if cache_size is None and url.port == TRANSACTION_POOLER_PORT:
        cache_size = 0
        warnings.append(
            "DATABASE_URL uses port 6543 (transaction pooler); prepared-statement caching "
            "is disabled. The session pooler (port 5432) is recommended for this app."
        )
    if cache_size is not None:
        connect_args["statement_cache_size"] = cache_size
        if cache_size == 0:
            # Transaction-mode poolers may route each statement to a different backend:
            # also drop SQLAlchemy's own prepared-statement cache and use unique names
            # so server-side prepared statements never collide.
            url = url.update_query_dict({"prepared_statement_cache_size": "0"})
            connect_args["prepared_statement_name_func"] = _unique_statement_name

    return DatabaseConfig(
        url=url,
        connect_args=connect_args,
        ssl_mode=resolved_ssl,
        statement_cache_size=cache_size,
        warnings=tuple(warnings),
    )


def _unique_statement_name() -> str:
    return f"__asyncpg_{uuid4()}__"


def database_config_from_settings(settings: Any) -> DatabaseConfig:
    return build_database_config(
        settings.database_url,
        ssl_mode=settings.db_ssl_mode,
        statement_cache_size=settings.db_statement_cache_size,
    )
