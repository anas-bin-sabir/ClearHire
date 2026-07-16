"""Alembic environment.

Runs against the app's async engine URL. When the app calls migrations itself
(see app/db/migrate.py) it passes an open sync connection through
``config.attributes["connection"]`` so no second engine or event loop is needed.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.db.url import database_config_from_settings
from app.models.orm import Base

config = context.config
target_metadata = Base.metadata

# Same URL normalisation / SSL / pooler handling as the app engine (app/db/session.py).
db_config = database_config_from_settings(settings)
database_url = db_config.url_string


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(
        database_url, poolclass=pool.NullPool, connect_args=db_config.connect_args
    )
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        do_run_migrations(connection)
        return
    if config.config_file_name is not None:
        fileConfig(config.config_file_name)
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
