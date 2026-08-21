# Configuration Documentation

## Overview

The application uses a comprehensive configuration system with:

- **Environment Variables**: Validated with envalid
- **Type Safety**: Strict TypeScript typing for all configs
- **Centralized Management**: All configs in `src/libs/config/`

## Configuration Files

### Environment Variables (`env.config.ts`)

Base environment variable validation using envalid.

**Location**: `src/libs/config/env.config.ts`

### Application Config (`app.config.ts`)

Core application settings.

| Variable          | Type      | Default         | Description                                                |
| ----------------- | --------- | --------------- | ---------------------------------------------------------- |
| `APP_NAME`        | `string`  | `"Elysia APP"`  | Application name                                           |
| `APP_PORT`        | `number`  | `3000`          | HTTP server port                                           |
| `APP_URL`         | `string`  | Required        | Public application URL                                     |
| `NODE_ENV`        | `string`  | `"development"` | Environment (development, staging, production)             |
| `APP_TIMEZONE`    | `string`  | `"UTC"`         | Application timezone (IANA format)                         |
| `APP_KEY`         | `string`  | Required        | Application secret key                                     |
| `ENABLE_API_DOCS` | `boolean` | `false`         | Serves the Scalar UI at `/docs`. Independent of `NODE_ENV` |
| `LOG_LEVEL`       | `string`  | `"info"`        | Logging level (info, warn, debug, error)                   |
| `CLIENT_URL`      | `string`  | Required        | Frontend/client application URL                            |

#### Cluster Mode

When `APP_CLUSTER_MODE=true`, the entry process (`src/index.ts`) acts as a Node `cluster` primary and forks worker processes. Each worker boots the full app from `src/server.ts` and listens on `APP_PORT`. Elysia on Bun enables `SO_REUSEPORT` automatically (Linux only), so the kernel distributes incoming connections across workers. Crashed workers are auto-respawned; `SIGINT`/`SIGTERM` to the primary terminates all workers.

| Variable              | Type     | Default | Description                                                                |
| --------------------- | -------- | ------- | -------------------------------------------------------------------------- |
| `APP_CLUSTER_MODE`    | `bool`   | `false` | Enable multi-process cluster mode                                          |
| `APP_CLUSTER_WORKERS` | `number` | `0`     | Number of workers to fork. `0` (or unset) uses `os.availableParallelism()` |

Notes:

- BullMQ workers boot inside every cluster worker — Redis handles job locking so jobs are not double-processed; queue throughput scales with the cluster.
- Keep `APP_CLUSTER_MODE=false` for `bun run dev` — `--hot --watch` doesn't play well with forked workers.

**Example `.env`**:

```bash
NODE_ENV="development"
APP_NAME="Elysia APP"
APP_PORT=3000
APP_URL="http://localhost:3000"
APP_TIMEZONE="UTC"
APP_KEY="your-app-key"
JWT_SECRET="change-me-before-running"
ENABLE_API_DOCS=true
LOG_LEVEL="info"
CLIENT_URL="http://localhost:3000"
```

### Database Config (`database.config.ts`)

PostgreSQL database configuration.

| Variable       | Type     | Description                  |
| -------------- | -------- | ---------------------------- |
| `DATABASE_URL` | `string` | PostgreSQL connection string |

**Example**:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/elysia_db"
```

**Validation Rules**:

- Must be valid URL format
- Must start with `postgres://` or `postgresql://`

### Redis Config (`redis.config.ts`)

Redis cache and queue configuration.

| Variable         | Type     | Default       | Description                 |
| ---------------- | -------- | ------------- | --------------------------- |
| `REDIS_HOST`     | `string` | `"localhost"` | Redis server hostname       |
| `REDIS_PORT`     | `number` | `6379`        | Redis server port           |
| `REDIS_PASSWORD` | `string` | `""`          | Redis password (optional)   |
| `REDIS_DB`       | `number` | `0`           | Redis database index (0-15) |

**Example**:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=password123
REDIS_DB=0
```

### ClickHouse Config (`clickhouse.config.ts`)

ClickHouse analytics database configuration.

| Variable              | Type     | Description              |
| --------------------- | -------- | ------------------------ |
| `CLICKHOUSE_HOST`     | `string` | ClickHouse server URL    |
| `CLICKHOUSE_USER`     | `string` | ClickHouse username      |
| `CLICKHOUSE_PASSWORD` | `string` | ClickHouse password      |
| `CLICKHOUSE_DATABASE` | `string` | ClickHouse database name |

**Example**:

```bash
CLICKHOUSE_HOST="http://localhost:8123"
CLICKHOUSE_USER="app"
CLICKHOUSE_PASSWORD="secret"
CLICKHOUSE_DATABASE="app"
```

### Mail Config (`mail.config.ts`)

SMTP mail server configuration.

| Variable      | Type     | Default | Description          |
| ------------- | -------- | ------- | -------------------- |
| `MAIL_HOST`   | `string` | `""`    | SMTP server hostname |
| `MAIL_PORT`   | `number` | `587`   | SMTP server port     |
| `MAIL_SECURE` | `string` | `""`    | Use TLS/SSL          |
| `MAIL_USER`   | `string` | `""`    | SMTP username        |
| `MAIL_PASS`   | `string` | `""`    | SMTP password        |
| `MAIL_FROM`   | `string` | `""`    | Default sender email |

**Example**:

```bash
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
MAIL_FROM=noreply@yourdomain.com
```

### CORS Config (`cors.config.ts`)

Cross-Origin Resource Sharing configuration.

| Variable       | Type     | Default | Description                       |
| -------------- | -------- | ------- | --------------------------------- |
| `ALLOWED_HOST` | `string` | `"*"`   | Allowed origins (comma-separated) |

**Example**:

```bash
ALLOWED_HOST="http://localhost:3000,https://yourdomain.com"
```

**Production Warning**: Never use `*` for `ALLOWED_HOST` in production.

### JWT Config (`jwt.config.ts`)

JWT authentication configuration.

| Variable     | Type     | Default            | Description                                            |
| ------------ | -------- | ------------------ | ------------------------------------------------------ |
| `JWT_SECRET` | `string` | **None. Required** | Signs and verifies every token. Startup fails if unset |

## Usage Examples

### Accessing Configuration

```typescript
import { AppConfig, DatabaseConfig } from "@config";

console.log(`Server running on port ${AppConfig.APP_PORT}`);
console.log(`Environment: ${AppConfig.APP_ENV}`);
```

### Conditional Logic Based on Environment

```typescript
import { AppConfig } from "@config";

if (AppConfig.APP_ENV === "production") {
	// Production-specific logic
} else {
	// Development logic
}
```

## Best Practices

### 1. Never Commit Secrets

Use `.env.example` as a template (committed, no secrets) and keep `.env` files git-ignored.

### 2. Use Strong Secrets

```bash
# Generate strong secrets
openssl rand -hex 32
```

### 3. Use Type Imports

```typescript
import { AppConfig } from "@config";
```

### 4. Document New Config Options

When adding new configuration:

1. Add to `env.config.ts` with envalid validation
2. Create/update config file in `src/libs/config/`
3. Update `.env.example`
4. Document in this file

## Troubleshooting

### Configuration Validation Failed

**Symptom**: Application fails to start with configuration errors

**Solution**:

1. Check the error message for specific fields
2. Verify `.env` file has all required variables
3. Ensure values match expected formats
4. Check for typos in variable names

### CORS Issues in Production

**Symptom**: CORS errors in production despite configuration

**Solution**:

1. Never use `*` for `ALLOWED_HOST` in production
2. Set specific domains: `ALLOWED_HOST=https://domain1.com,https://domain2.com`
3. Verify CLIENT_URL is set correctly

### Missing Environment Variables

**Symptom**: Envalid throws errors about missing variables

**Solution**:

1. Copy `.env.example` to `.env`
2. Fill in all required values
3. Restart the application

## Porting configuration between the sibling templates

This template has three siblings — `clean-elysia`, `clean-elysia-prisma`, `clean-nest-drizzle-pg`,
and `clean-nest-prisma-pg` — and the two families use **different names for the same concepts**. The
names are internally consistent within each family and are deliberately left alone; this table is
here so an `.env` can be carried across without silently losing a setting.

**14 variables are common to all four**: `APP_NAME`, `APP_PORT`, `APP_TIMEZONE`, `APP_URL`,
`DATABASE_URL`, `JWT_SECRET`, `MAIL_FROM`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `NODE_ENV`,
`REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_PORT`.

| Concern          | Elysia family            | NestJS family                                                                     |
| ---------------- | ------------------------ | --------------------------------------------------------------------------------- |
| App secret       | `APP_KEY`                | `APP_SECRET`                                                                      |
| CORS origin      | `ALLOWED_HOST`           | `ALLOWED_ORIGINS`, `ALLOWED_METHODS`, `ALLOWED_HEADERS`, `MAX_AGE`, `CREDENTIALS` |
| Front-end URL    | `CLIENT_URL`             | `FRONTEND_URL`                                                                    |
| Mail credentials | `MAIL_USER`, `MAIL_PASS` | `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_DEFAULT_SUBJECT`                          |
| Redis extra      | `REDIS_DB`               | `REDIS_TTL`                                                                       |
| JWT              | `JWT_SECRET` only        | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`    |

**Elysia-only** (no NestJS equivalent): `APP_CLUSTER_MODE`, `APP_CLUSTER_WORKERS`, `APP_REUSE_PORT`,
`LOG_LEVEL`, `CLICKHOUSE_HOST`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`.

**NestJS-only**: `THROTTLER_TTL`, `THROTTLER_LIMIT`, `APP_VERSION`. `THROTTLER_TTL` /
`THROTTLER_LIMIT` drive the Nest throttler from the environment; the Elysia rate limit is
**hardcoded** in `src/libs/plugins/security.plugin.ts` (100 requests / 60s), with no environment
variable to set.

**Same concept, different name:** this repo's `ENABLE_API_DOCS` is the NestJS family's
`API_DOCS_ENABLED`. Both are explicit flags defaulting to `false`, both are independent of
`NODE_ENV`, and both exist so an environment that never sets the variable cannot expose the schema.
Carry the value across, not the name. The sibling `clean-elysia-prisma` uses the same
`ENABLE_API_DOCS` name and semantics, so all four repos now fail closed.

### `JWT_SECRET` is required, and `APP_JWT_SECRET` is gone

Both Elysia repos used to declare **two** JWT-looking variables, and only one of them did anything:
`JWT_SECRET` reached `AuthPlugin` through `jwt.config.ts`, while `APP_JWT_SECRET` was surfaced on
`AppConfig` and read by nothing. Because both carried permissive defaults, an operator who set
`APP_JWT_SECRET` believing it secured JWTs left every token signed with the built-in
`"your-secret-key"` — and the app booted without complaint.

Resolved 2026-08-21 in both repos:

- **`APP_JWT_SECRET` was removed** from `env.config.ts`, `app.config.ts`, and `.env.example`. It is
  no longer a valid variable; setting it does nothing and envalid ignores it.
- **`JWT_SECRET` lost its default.** It is declared `str()` with no fallback, so a process without
  it fails at startup with an envalid error rather than signing tokens with a published value.

This is a breaking change for any environment that was booting without `JWT_SECRET` set. Generate
one with `openssl rand -base64 48`. Note that every entry point that imports `@config` is affected,
including seeds and the `i18n:keys` script — they all validate the same environment.

## Further Reading

- [Envalid Documentation](https://github.com/af/envalid)
- [Environment Variables Best Practices](https://12factor.net/config)
- [CORS Configuration Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
