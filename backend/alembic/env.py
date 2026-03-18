"""
Alembic Environment Configuration — PipelinePulse
Loads DATABASE_URL from environment (or .env file) and configures
the Alembic connection with AUTOCOMMIT so CREATE SCHEMA DDL works.
"""
import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import create_engine, pool

from alembic import context

# ── Load .env (override=False so shell env vars take priority) ─
_here = os.path.dirname(os.path.abspath(__file__))
_dotenv_path = os.path.join(_here, "..", ".env")
load_dotenv(dotenv_path=_dotenv_path, override=False)

# ── Alembic Config ─────────────────────────────────────────────
config = context.config

# Build a clean psycopg2 URL from DATABASE_URL env var.
# Replace asyncpg driver variant so alembic CLI works without an event loop.
_raw_url = os.environ.get("DATABASE_URL", "")
if not _raw_url:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Copy .env.example to .env and fill in the values."
    )
_sync_url = (
    _raw_url
    .replace("postgresql+asyncpg://", "postgresql+psycopg2://")
)

# ── Logging ────────────────────────────────────────────────────
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None


# ── Offline mode ───────────────────────────────────────────────
def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode ────────────────────────────────────────────────
def run_migrations_online() -> None:
    # Build the engine directly from our resolved URL (not from alembic.ini)
    # so the placeholder URL in alembic.ini is never used.
    engine = create_engine(
        _sync_url,
        poolclass=pool.NullPool,
        isolation_level="AUTOCOMMIT",
    )
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
