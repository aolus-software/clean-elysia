# Clean Elysia

A clean architecture backend API built with Elysia.js, TypeScript, and Bun.

## Features

- Clean architecture pattern with separation of concerns
- Elysia.js web framework with TypeBox validation
- PostgreSQL with Drizzle ORM
- Redis for caching and rate limiting
- BullMQ for background job processing
- ClickHouse for analytics (optional)
- Comprehensive authentication and authorization (RBAC)
- API documentation with OpenAPI and Scalar
- Docker support

## Tech Stack

- **Runtime**: Bun
- **Framework**: Elysia.js
- **Language**: TypeScript
- **Databases**: PostgreSQL, Redis, ClickHouse
- **ORM**: Drizzle
- **Queue**: BullMQ
- **Validation**: TypeBox
- **API Docs**: OpenAPI + Scalar

## Prerequisites

- Bun 1.x or higher
- PostgreSQL
- Redis
- Docker (optional)

## Installation

Install dependencies:

```sh
bun install
```

## Configuration

Copy the example environment file and configure your environment variables:

```sh
cp .env.example .env
```

Configure the following environment variables:

- Database connections (PostgreSQL, Redis, ClickHouse)
- Mail settings
- JWT secrets
- Application settings

See [Configuration Documentation](./docs/CONFIGURATION.md) for detailed reference. The PostgreSQL
pool is sized per process with `DB_POOL_MAX` / `DB_POOL_IDLE_TIMEOUT_MS` /
`DB_POOL_CONNECTION_TIMEOUT_MS`, and `DB_LOG_QUERIES=true` (with `LOG_LEVEL=debug`) logs each SQL
statement without its parameters.

## Database Setup

Generate and run PostgreSQL migrations:

```sh
bun run db:generate
bun run db:migrate
```

Seed the database with initial data:

```sh
bun run db:seed
```

The seed creates one verified account per role (`superuser@example.com`, `admin@example.com`) with the password `S3crEtP4ssw0rd!`. Change it before using the seed anywhere shared.

For development, you can also use:

```sh
bun run db:push  # Push schema directly without migrations
```

Open Drizzle Studio to view and edit data:

```sh
bun run db:studio
```

Run ClickHouse migrations:

```sh
bun run db:clickhouse:migrate
```

Check ClickHouse migration status:

```sh
bun run db:clickhouse:status
```

## Development

Run the API server in development mode:

```sh
bun run dev
```

The API will be available at http://localhost:3000

## Production

Build the application:

```sh
bun run build
```

Start the production server:

```sh
bun run start
```

## Docker

Build and run with Docker Compose:

```sh
docker-compose up -d
```

The `postgres` service logs every statement slower than `POSTGRES_SLOW_QUERY_MS` (default `100` ms,
`-1` disables) to the container log: `docker compose logs postgres`.

## Project Structure

```
src/
├── app.ts                 # Composed Elysia app (not listening); used by server.ts and tests
├── base.ts                # Base Elysia app with core plugins
├── index.ts               # Entry point
├── server.ts              # Binds app.ts to APP_PORT
├── bull/                  # Background jobs
│   ├── queue/             # Job queues
│   └── worker/            # Job workers
├── libs/                  # Shared libraries
│   ├── cache/             # Cache utilities
│   ├── config/            # Configuration
│   ├── database/          # Database clients and repositories
│   ├── errors/            # Custom error classes
│   ├── guards/            # Authorization guards
│   ├── mailer/            # Email service
│   ├── plugins/           # Elysia plugins
│   ├── repositories/      # Data access layer
│   ├── types/             # TypeScript types
│   └── utils/             # Utility functions
└── modules/               # Feature modules
    ├── auth/              # Authentication
    ├── home/              # Root/health endpoints
    ├── profile/           # User profile
    └── settings/          # Application settings
tests/
├── setup.ts               # bun test preload: pins test env (NODE_ENV, JWT secret, *_test DB, Redis db 15)
├── helpers/               # in-process app + queue capture, database reset, login/token helpers
├── unit/                  # pure toolkits, no database or Redis
└── integration/           # HTTP through app.handle against PostgreSQL + Redis
```

## Code Quality

Run linting:

```sh
bun run lint
```

Fix linting issues:

```sh
bun run lint:fix
```

Format code:

```sh
bun run format
```

Type checking:

```sh
bun run typecheck
```

## Tests

Bun's built-in runner (`bun test`), configured in `bunfig.toml`. `tests/unit/` needs nothing running;
`tests/integration/` drives the app in-process through `app.handle(new Request(...))` against a real
PostgreSQL and Redis. The integration helpers migrate, truncate and re-seed the database, so they
refuse any database whose name does not end in `_test`. Redis uses db `15` (`TEST_REDIS_DB`) and is
flushed. Mail jobs are captured in memory, never queued.

```sh
docker compose up -d postgres redis
docker compose exec postgres createdb -U postgres clean_elysia_test
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clean_elysia_test bun run test
```

`bun run test:coverage` writes `coverage/lcov.info` and fails when total line coverage drops below
64% (`tests/coverage-gate.ts`). That is the current baseline, raised as tests land. CI runs it with
PostgreSQL and Redis services.

## API Documentation

Once the server is running, access the interactive API documentation at:

```
http://localhost:3000/docs
```

The API documentation is powered by **OpenAPI** with **Scalar UI**, providing:

- Browse all endpoints with request/response schemas
- Try endpoints directly from the browser
- View validation rules and examples
- Bearer token authentication support

Download the OpenAPI specification:

```
http://localhost:3000/docs/openapi.json
```

For more details, see the [API Documentation Guide](./docs/API_DOCUMENTATION.md).

## Scripts

### Development

- `bun run dev` - Run API server with hot reload
- `bun run build` - Build the application
- `bun run start` - Start the production server

### Code Quality

- `bun run lint` - Run ESLint
- `bun run lint:fix` - Fix ESLint issues
- `bun run format` - Format code with Prettier
- `bun run typecheck` - Run TypeScript type checking

### Tests

- `bun run test` - Run every test (integration needs `TEST_DATABASE_URL` + Redis)
- `bun run test:watch` - Re-run tests on change
- `bun run test:unit` - Run unit tests (no database)
- `bun run test:integration` - Run integration tests against `TEST_DATABASE_URL`
- `bun run test:coverage` - Run every test with coverage and the 64% total line gate

### Database (PostgreSQL/Drizzle)

- `bun run db:generate` - Generate migration files from schema
- `bun run db:migrate` - Apply pending migrations
- `bun run db:push` - Push schema to database (development only)
- `bun run db:pull` - Pull schema from database
- `bun run db:studio` - Open Drizzle Studio
- `bun run db:drop` - Drop every table and the migration journal (dangerous!)
- `bun run db:seed` - Seed database with initial data

### Database (ClickHouse)

- `bun run db:clickhouse:migrate` - Run ClickHouse migrations
- `bun run db:clickhouse:status` - Check migration status

### Makefile Commands

You can also use `make` commands:

- `make help` - Show all available commands
- `make dev` - Start development server
- `make test` / `make test-unit` / `make test-integration` / `make test-coverage` - Run the tests
- `make fresh` - Drop, migrate, and seed (development)
- `make reset` - Generate migrations, migrate, and seed

## Documentation

Comprehensive documentation is available in the [docs/](./docs/) directory:

- [API Documentation](./docs/API_DOCUMENTATION.md) - API consumer guide
- [Configuration](./docs/CONFIGURATION.md) - Environment variables reference
- [Error Handling](./docs/ERROR_HANDLING.md) - Error handling guide
- [Plugins](./docs/PLUGINS.md) - Plugin system guide
- [Security](./docs/SECURITY.md) - Security documentation

## Architecture

This project follows Clean Architecture principles:

### Layers

1. **Modules** - Feature-based modules containing routes and business logic
2. **Repositories** - Data access layer with database operations
3. **Services** - Business logic and orchestration
4. **Plugins** - Cross-cutting concerns (logging, error handling, security)
5. **Utils** - Helper functions and utilities

### Key Patterns

- **Repository Pattern** - Factory functions returning database access methods
- **Service Pattern** - Object exports with business logic methods
- **Plugin Pattern** - Reusable Elysia plugins for middleware
- **Error Handling** - Custom error classes with consistent API responses
- **Validation** - TypeBox schemas for runtime validation

## Roadmap & Improvements

See [TODO.md](./TODO.md) for a comprehensive list of planned improvements and enhancements.

Compare with clean-hono implementation: [COMPARISON.md](../COMPARISON.md)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

Please read our Contributing Guidelines and Code of Conduct.

## License

This project is licensed under the MIT License.
