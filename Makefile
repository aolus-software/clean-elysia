.PHONY: help dev build start lint format seed db-generate db-migrate db-push db-pull db-studio db-drop dev-worker build-worker start-worker dev-server build-server start-server dev-all build-all start-all

# Default target
help:
	@echo "Available commands:"
	@echo "  Development:"
	@echo "    dev-api         - Start API development server with hot reload"
	@echo "    build-api       - Build the API application"
	@echo "    start-api       - Start the API production server"
	@echo "    dev-server      - Start SERVER development server with hot reload"
	@echo "    build-server    - Build the SERVER application"
	@echo "    start-server    - Start the SERVER production server"
	@echo "    dev-worker      - Start WORKER development with hot reload"
	@echo "    build-worker    - Build the WORKER application"
	@echo "    start-worker    - Start the WORKER production service"
	@echo "    dev-all         - Run server and worker in dev mode concurrently"
	@echo "    build-all       - Build server and worker concurrently"
	@echo "    start-all       - Run server and worker in production concurrently"
	@echo "    lint            - Run ESLint"
	@echo "    format          - Format code with Prettier"
	@echo "    seed            - Run database seeder"
	@echo ""
	@echo "  Database (Drizzle):"
	@echo "    db-generate - Generate migration files"
	@echo "    db-migrate  - Run pending migrations"
	@echo "    db-push     - Push schema to database (dev only)"
	@echo "    db-pull     - Pull schema from database"
	@echo "    db-studio   - Open Drizzle Studio"
	@echo "    db-drop     - Drop all tables (dangerous!)"
	@echo ""
	@echo "  Database (ClickHouse):"
	@echo "    migrate-clickhouse - Run ClickHouse migrations"
	@echo "    migrate-clickhouse-status - Check status of ClickHouse migrations"

# Development commands
dev-api:
	bun run dev:api

build-api:
	bun run build:api

start-api:
	bun run start:api

dev-server:
	bun run dev:server

build-server:
	bun run build:server

start-server:
	bun run start:server

dev-worker:
	bun run dev:worker

build-worker:
	bun run build:worker

start-worker:
	bun run start:worker

lint:
	bun run lint

format:
	bun run format

db-seed:
	bun run infra/seed/index.ts

migrate-clickhouse:
	bun run infra/clickhouse/scripts/migrate.ts migrate

migrate-clickhouse-status:
	bun run infra/clickhouse/scripts/migrate.ts status

# Database commands
# db-generate:
# 	bunx drizzle-kit generate

# db-migrate:
# 	bunx drizzle-kit migrate

# db-push:
# 	bunx drizzle-kit push

# db-pull:
# 	bunx drizzle-kit introspect

# db-studio:
# 	bunx drizzle-kit studio

# db-drop:
# 	bunx drizzle-kit drop

db-generate:
	npx drizzle-kit generate

db-migrate:
	npx drizzle-kit migrate

db-push:
	npx drizzle-kit push

db-pull:
	npx drizzle-kit introspect

db-studio:
	npx drizzle-kit studio

db-drop:
	npx drizzle-kit drop

dev-all:
	bun run dev:all

build-all:
	bun run build:all

start-all:
	bun run start:all

# Combined commands for common workflows
fresh: db-drop db-push seed
	@echo "Database refreshed and seeded!"

reset: db-generate db-migrate seed
	@echo "Database migrated and seeded!"
