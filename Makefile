# Auto-detect docker compose command
DOCKER_COMPOSE := $(shell docker compose version > /dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

.DEFAULT_GOAL := start

.PHONY: start stop restart reset logs logs-backend logs-frontend logs-airflow shell-backend shell-db ps build

start:
	@chmod +x start.sh
	@./start.sh

stop:
	@echo "Stopping all services..."
	@$(DOCKER_COMPOSE) down

restart:
	@$(MAKE) stop
	@$(MAKE) start

reset:
	@echo "⚠️  WARNING: This will remove all containers, volumes, and the .env file!"
	@echo "⚠️  All data will be lost. Press Ctrl+C to cancel or Enter to continue..."
	@read -r
	@$(DOCKER_COMPOSE) down -v --remove-orphans
	@rm -f .env
	@echo "✓ Reset complete"

logs:
	@$(DOCKER_COMPOSE) logs -f

logs-backend:
	@$(DOCKER_COMPOSE) logs -f backend

logs-frontend:
	@$(DOCKER_COMPOSE) logs -f frontend

logs-airflow:
	@$(DOCKER_COMPOSE) logs -f airflow-scheduler

shell-backend:
	@$(DOCKER_COMPOSE) exec backend bash

shell-db:
	@$(DOCKER_COMPOSE) exec postgres psql -U pp_user -d pipelinepulse

ps:
	@$(DOCKER_COMPOSE) ps

build:
	@$(DOCKER_COMPOSE) build --no-cache
