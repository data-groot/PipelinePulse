.PHONY: migrate rollback db-reset shell help

# ── Configuration ──────────────────────────────────────────────────────────────
PYTHON     ?= python
ALEMBIC    ?= alembic

# ── Migration targets ──────────────────────────────────────────────────────────

## migrate: Apply all pending Alembic migrations (upgrade to head)
migrate:
	$(ALEMBIC) upgrade head

## rollback: Revert the most recent migration
rollback:
	$(ALEMBIC) downgrade -1

## db-reset: Wipe all 4 schemas and re-run all migrations from scratch
db-reset:
	@echo "⚠️  Dropping all schemas (bronze, silver, gold, meta)..."
	$(ALEMBIC) downgrade base
	@echo "✅  Recreating schemas from head..."
	$(ALEMBIC) upgrade head

## history: Show migration history
history:
	$(ALEMBIC) history --verbose

## current: Show current migration revision
current:
	$(ALEMBIC) current

## help: Show this help message
help:
	@grep -E '^##' Makefile | sed 's/^## //'
