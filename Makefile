.PHONY: help install dev build start lint lint-fix format typecheck db-generate db-migrate db-push db-pull db-studio db-drop db-seed db-clickhouse-migrate db-clickhouse-status fresh reset docker-build docker-up docker-down docker-restart docker-logs docker-ps docker-migrate docker-seed docker-deploy

# Docker compose derives its project name from the directory name (lowercased);
# the app network is "<project>_app_network". Override if you renamed the dir:
#   make docker-migrate DOCKER_NETWORK=myproject_app_network
DOCKER_NETWORK ?= $(shell basename "$(CURDIR)" | tr '[:upper:]' '[:lower:]')_app_network
MIGRATOR_IMAGE ?= clean-elysia:migrator

# Default target
help:
	@echo "Available commands:"
	@echo ""
	@echo "  Setup:"
	@echo "    install             - Install dependencies"
	@echo ""
	@echo "  Development:"
	@echo "    dev             	   - Run dev server with hot reload"
	@echo ""
	@echo "  Build:"
	@echo "    build           	   - Build the application"
	@echo ""
	@echo "  Production:"
	@echo "    start               - Start the production server"
	@echo ""
	@echo "  Code Quality:"
	@echo "    lint                - Run ESLint"
	@echo "    lint-fix            - Fix ESLint issues"
	@echo "    format              - Format code with Prettier"
	@echo "    typecheck           - Run TypeScript type checking"
	@echo ""
	@echo "  Database (PostgreSQL/Drizzle):"
	@echo "    db-generate         - Generate migration files"
	@echo "    db-migrate          - Run pending migrations"
	@echo "    db-push             - Push schema to database (dev only)"
	@echo "    db-pull             - Pull schema from database"
	@echo "    db-studio           - Open Drizzle Studio"
	@echo "    db-drop             - Drop all tables (dangerous!)"
	@echo "    db-seed             - Seed database with initial data"
	@echo ""
	@echo "  Database (ClickHouse):"
	@echo "    db-clickhouse-migrate - Run ClickHouse migrations"
	@echo "    db-clickhouse-status  - Check ClickHouse migration status"
	@echo ""
	@echo "  Docker:"
	@echo "    docker-build        - Build all compose images (app + migrator)"
	@echo "    docker-up           - Start the full stack (build if needed)"
	@echo "    docker-down         - Stop the stack"
	@echo "    docker-restart      - Restart the app container"
	@echo "    docker-logs         - Tail app logs"
	@echo "    docker-ps           - Show stack status"
	@echo "    docker-migrate      - Run DB migrations against the compose network"
	@echo "    docker-seed         - Seed the database inside the compose network"
	@echo "    docker-deploy       - git pull + build + up + migrate (server deploy)"
	@echo ""
	@echo "  Workflows:"
	@echo "    fresh               - Drop, push schema, and seed (dev only)"
	@echo "    reset               - Generate, migrate, and seed"

install:
	bun install

dev:
	bun run dev

build:
	bun run build

start:
	bun run start

# Code quality
lint:
	bun run lint

lint-fix:
	bun run lint:fix

format:
	bun run format

typecheck:
	bun run typecheck

# Database (PostgreSQL/Drizzle)
db-generate:
	bun run db:generate

db-migrate:
	bun run db:migrate

db-push:
	bun run db:push

db-pull:
	bun run db:pull

db-studio:
	bun run db:studio

db-drop:
	bun run db:drop

db-seed:
	bun run db:seed

# Database (ClickHouse)
db-clickhouse-migrate:
	bun run db:clickhouse:migrate

db-clickhouse-status:
	bun run db:clickhouse:status

# Docker (compose stack — config comes from .env, see docs/DEPLOYMENT.md)
docker-build:
	docker compose build
	docker build --target migrator -t $(MIGRATOR_IMAGE) .

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-restart:
	docker compose restart app

docker-logs:
	docker compose logs -f app

docker-ps:
	docker compose ps

docker-migrate:
	docker build --target migrator -t $(MIGRATOR_IMAGE) .
	docker run --rm --network $(DOCKER_NETWORK) --env-file .env $(MIGRATOR_IMAGE)

docker-seed:
	docker build --target migrator -t $(MIGRATOR_IMAGE) .
	docker run --rm --network $(DOCKER_NETWORK) --env-file .env --entrypoint bun $(MIGRATOR_IMAGE) run db:seed

# Full server deploy: pull latest, rebuild, roll the stack, migrate
docker-deploy:
	git pull
	docker compose up -d --build
	$(MAKE) docker-migrate
	@echo "Deployed!"

# Combined workflows
fresh: db-drop db-push db-seed
	@echo "Database refreshed and seeded!"

reset: db-generate db-migrate db-seed
	@echo "Database migrated and seeded!"