.PHONY: up down restart logs build db-reset seed dbt-run web api

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

build:
	docker-compose build

db-reset:
	docker-compose down -v
	docker-compose up -d postgres backend
	@echo "Waiting for postgres to initialize..."
	sleep 5
	docker-compose restart backend

dbt-run:
	docker-compose run --rm dbt-runner dbt run

dbt-test:
	docker-compose run --rm dbt-runner dbt test

# Easy commands for booting
api:
	docker-compose up -d backend

web:
	docker-compose up -d frontend

airflow:
	docker-compose up -d airflow-webserver airflow-scheduler
