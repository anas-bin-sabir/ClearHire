"""Programmatic Alembic upgrades used at app startup and in tests."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.engine import Connection

BACKEND_ROOT = Path(__file__).resolve().parents[2]
BASELINE_REVISION = "0001_baseline"


def alembic_config(connection: Connection | None = None) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    if connection is not None:
        config.attributes["connection"] = connection
    return config


def upgrade_to_head(connection: Connection) -> None:
    """Upgrade the schema; adopt databases created before Alembic was introduced.

    Earlier versions built the schema with ``metadata.create_all`` at startup. Such a
    database already matches the baseline, so it is stamped instead of re-created.
    """
    config = alembic_config(connection)
    tables = set(inspect(connection).get_table_names())
    if "alembic_version" not in tables and "users" in tables:
        command.stamp(config, BASELINE_REVISION)
    command.upgrade(config, "head")
