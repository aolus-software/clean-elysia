.PHONY: help lint lint-fix format seed db-generate db-migrate db-push db-pull db-studio db-drop dev build start

# Default target
help:
	@echo "Available commands:"
	@echo "  Development:"
	@echo "    dev             - Start development server with hot reload"
	@echo "    build           - Build the application"
	@echo "    start           - Start the production server"
	@echo "    lint            - Run ESLint"
	@echo "    lint-fix        - Fix linting issues automatically"
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
dev:
	bun run dev

build:
	bun run build

start:
	bun run start

lint:
	bun run lint

lint-fix:
	bun run lint:fix

format:
	bun run format

db-seed:
	bun run infra/seed/index.ts

migrate-clickhouse:
	bun run migrate:clickhouse

migrate-clickhouse-status:
	bun run migrate:clickhouse:status

# Database commands
db-generate:
	bunx drizzle-kit generate

db-migrate:
	bunx drizzle-kit migrate

db-push:
	bunx drizzle-kit push

db-pull:
	bunx drizzle-kit introspect

db-studio:
	bunx drizzle-kit studio

db-drop:
	bunx drizzle-kit drop

deploy-prepare:
	@echo "Preparing deployment..."
	bun install
	bunx drizzle-kit migrate
	bun run build
	@echo "Deployment package is ready!"

# Combined commands for common workflows
fresh: db-drop db-push seed
	@echo "Database refreshed and seeded!"

reset: db-generate db-migrate seed
	@echo "Database migrated and seeded!"