"""Initial schema — bronze, silver, gold, meta

Revision ID: 001
Revises:
Create Date: 2026-03-16

Executes the full DDL from 001_initial_schema.sql via op.execute(sa.text()).
env.py configures the engine with isolation_level=AUTOCOMMIT so
CREATE SCHEMA/TABLE/INDEX and alembic_version stamping all work correctly.
All statements use IF NOT EXISTS so this migration is idempotent.
"""
from typing import Sequence, Union
import os
import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SQL_FILE = os.path.join(os.path.dirname(__file__), "001_initial_schema.sql")


def _load_sql() -> str:
    with open(_SQL_FILE, "r", encoding="utf-8") as fh:
        return fh.read()


def upgrade() -> None:
    """Apply the full initial schema."""
    op.execute(sa.text(_load_sql()))


def downgrade() -> None:
    """Drop all four schemas (CASCADE removes all tables and indexes)."""
    op.execute(sa.text("DROP SCHEMA IF EXISTS gold   CASCADE"))
    op.execute(sa.text("DROP SCHEMA IF EXISTS silver CASCADE"))
    op.execute(sa.text("DROP SCHEMA IF EXISTS bronze CASCADE"))
    op.execute(sa.text("DROP SCHEMA IF EXISTS meta   CASCADE"))
