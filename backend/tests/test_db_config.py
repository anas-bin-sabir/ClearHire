"""Pure tests for DATABASE_URL normalisation and asyncpg connect_args (no database).

Runnable without Postgres: ``pytest --noconftest tests/test_db_config.py``.
"""

import ssl

import pytest

from app.db.url import build_database_config, is_supabase_host, normalize_ssl_mode

SUPABASE_SESSION = "postgresql://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
SUPABASE_TXN = "postgresql://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
SUPABASE_DIRECT = "postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres"
LOCAL = "postgresql+asyncpg://clearhire:clearhire123@localhost:5432/clearhire_db"


@pytest.mark.parametrize(
    "raw",
    [
        "postgres://u:p@h:5432/db",
        "postgresql://u:p@h:5432/db",
        "postgresql+psycopg2://u:p@h:5432/db",
        "postgresql+asyncpg://u:p@h:5432/db",
    ],
)
def test_driver_normalised_to_asyncpg(raw):
    cfg = build_database_config(raw)
    assert cfg.url.drivername == "postgresql+asyncpg"
    assert cfg.url_string == "postgresql+asyncpg://u:p@h:5432/db"


def test_password_special_chars_survive():
    cfg = build_database_config("postgresql://u:p%40ss%2Fw@h/db")
    assert cfg.url.password == "p@ss/w"
    assert "p%40ss%2Fw" in cfg.url_string


def test_local_defaults_have_no_ssl_or_cache_override():
    cfg = build_database_config(LOCAL)
    assert cfg.connect_args == {}
    assert cfg.ssl_mode is None
    assert cfg.warnings == ()


@pytest.mark.parametrize("raw", [SUPABASE_SESSION, SUPABASE_DIRECT])
def test_supabase_host_defaults_to_require(raw):
    cfg = build_database_config(raw)
    assert cfg.ssl_mode == "require"
    assert cfg.connect_args["ssl"] == "require"
    assert "statement_cache_size" not in cfg.connect_args


def test_explicit_disable_overrides_supabase_default():
    cfg = build_database_config(SUPABASE_DIRECT, ssl_mode="disable")
    assert cfg.ssl_mode == "disable"
    assert "ssl" not in cfg.connect_args


def test_sslmode_query_param_stripped_and_translated():
    cfg = build_database_config(
        "postgresql://u:p@h:5432/db?sslmode=require&application_name=clearhire"
    )
    assert "sslmode" not in cfg.url.query
    assert cfg.url.query["application_name"] == "clearhire"
    assert cfg.connect_args["ssl"] == "require"


def test_env_ssl_mode_beats_url_sslmode():
    cfg = build_database_config("postgresql://u:p@h/db?sslmode=require", ssl_mode="disable")
    assert "sslmode" not in cfg.url.query
    assert "ssl" not in cfg.connect_args


def test_url_sslmode_disable_beats_supabase_default():
    cfg = build_database_config(SUPABASE_DIRECT + "?sslmode=disable")
    assert "ssl" not in cfg.connect_args


def test_verify_full_uses_ssl_context():
    cfg = build_database_config(LOCAL, ssl_mode="verify-full")
    ctx = cfg.connect_args["ssl"]
    assert isinstance(ctx, ssl.SSLContext)
    assert ctx.check_hostname is True
    assert ctx.verify_mode == ssl.CERT_REQUIRED


def test_verify_ca_skips_hostname_check():
    ctx = build_database_config(LOCAL, ssl_mode="verify-ca").connect_args["ssl"]
    assert isinstance(ctx, ssl.SSLContext)
    assert ctx.check_hostname is False
    assert ctx.verify_mode == ssl.CERT_REQUIRED


def test_sslrootcert_stripped():
    cfg = build_database_config("postgresql://u:p@h/db?sslmode=require&sslrootcert=/nonexistent.crt")
    assert "sslrootcert" not in cfg.url.query
    assert cfg.connect_args["ssl"] == "require"


def test_transaction_pooler_disables_statement_cache_with_warning():
    cfg = build_database_config(SUPABASE_TXN)
    assert cfg.statement_cache_size == 0
    assert cfg.connect_args["statement_cache_size"] == 0
    assert cfg.url.query["prepared_statement_cache_size"] == "0"
    name_func = cfg.connect_args["prepared_statement_name_func"]
    assert name_func() != name_func()
    assert cfg.connect_args["ssl"] == "require"
    assert len(cfg.warnings) == 1 and "5432" in cfg.warnings[0]


def test_explicit_statement_cache_size_wins_on_6543():
    cfg = build_database_config(SUPABASE_TXN, statement_cache_size=100)
    assert cfg.connect_args["statement_cache_size"] == 100
    assert "prepared_statement_name_func" not in cfg.connect_args
    assert cfg.warnings == ()


def test_explicit_zero_cache_on_session_pooler():
    cfg = build_database_config(SUPABASE_SESSION, statement_cache_size=0)
    assert cfg.connect_args["statement_cache_size"] == 0
    assert cfg.warnings == ()


@pytest.mark.parametrize(
    ("host", "expected"),
    [
        ("db.abc.supabase.co", True),
        ("aws-0-us-east-1.pooler.supabase.com", True),
        ("supabase.co", True),
        ("notsupabase.co", False),
        ("supabase.co.evil.com", False),
        ("localhost", False),
        (None, False),
    ],
)
def test_is_supabase_host(host, expected):
    assert is_supabase_host(host) is expected


def test_normalize_ssl_mode():
    assert normalize_ssl_mode(None) is None
    assert normalize_ssl_mode("  ") is None
    assert normalize_ssl_mode("REQUIRE") == "require"
    with pytest.raises(ValueError):
        normalize_ssl_mode("on")


def test_settings_parse_db_env(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("DB_SSL_MODE", "Verify-Full")
    monkeypatch.setenv("DB_STATEMENT_CACHE_SIZE", "")
    s = Settings()
    assert s.db_ssl_mode == "verify-full"
    assert s.db_statement_cache_size is None
    assert s.db_pool_size == 5 and s.db_max_overflow == 5

    monkeypatch.setenv("DB_STATEMENT_CACHE_SIZE", "0")
    assert Settings().db_statement_cache_size == 0

    monkeypatch.setenv("DB_SSL_MODE", "bogus")
    with pytest.raises(ValueError):
        Settings()
