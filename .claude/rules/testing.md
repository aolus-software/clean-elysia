# Rule: Tests (`tests/`)

Bun's built-in runner. `bunfig.toml` preloads `tests/setup.ts` and writes lcov coverage.
`bun run test:coverage` (what CI runs) then runs `tests/coverage-gate.ts`, which fails when **total**
line coverage is below its `MIN_LINE_COVERAGE` (64%, the current baseline). Bun's own
`coverageThreshold` is per file, and its "All files" row averages per-file percentages, so neither is
used. Raise the gate when tests land; never lower it.

## Layout

```
tests/
├── setup.ts            # preload: pins NODE_ENV, LOG_LEVEL, JWT_SECRET, DATABASE_URL, REDIS_DB
├── coverage-gate.ts    # total line coverage from coverage/lcov.info vs MIN_LINE_COVERAGE
├── helpers/
│   ├── app.ts          # mocks @bull, imports src/app.ts, request(method, path, { body, token })
│   ├── database.ts     # resetDatabase(): migrate, truncate, seed, flush Redis; the _test guard
│   └── auth.ts         # login(email) -> access token; signAccessToken(userId)
├── unit/               # no database, no Redis
└── integration/        # through app.handle, real PostgreSQL + Redis
```

## Rules

1. **Unit tests import from aliases** (`@utils`, `@i18n`, `@config`) and touch no database or Redis.
2. **Integration tests go through HTTP** (`request(...)` → `app.handle(new Request(...))`), not
   services, so guards, validation and the envelope are exercised. Assert the status and the envelope
   fields that matter. Never start a listening server.
3. **Each integration file calls `resetDatabase()` in `beforeAll`.** Files share one process and one
   pool; never call `db.$client.end()` from a test.
4. **The database name must end in `_test`.** `resetDatabase` refuses anything else, because `bun test`
   also loads `.env`. Point `TEST_DATABASE_URL` at a dedicated database (default
   `clean_elysia_test` on localhost). Redis uses `TEST_REDIS_DB` (default `15`) and is flushed.
5. **`setup.ts` pins what `env.config.ts` would reject or what must never be real.** `bun test` sets
   `NODE_ENV=test`, which envalid refuses, so it is pinned to `development`; `LOG_LEVEL` is `warn`
   (the quietest value envalid accepts); `JWT_SECRET` is a throwaway.
6. **Mail is never queued.** `tests/helpers/app.ts` replaces `@bull` with an in-memory
   `sendEmailQueue` via `mock.module` **before** importing the app, so no BullMQ worker boots. Assert
   on `queuedMails`. Import the app only through that helper.
7. **Users from the seeder** (`superuser@example.com`, `admin@example.com`, password
   `S3crEtP4ssw0rd!`) are the fixtures. A user created through the API is unverified and cannot log
   in; sign an access token with `signAccessToken(id)` when a test needs one.
8. **The global rate limiter applies** (100 requests / 60 s). Under `app.handle` there is no listening
   server, so every request shares one bucket and `elysia-rate-limit` prints a "failed to determine
   client address" warning per request. Keep the integration suite well under 100 requests, or split
   it across processes.
9. A new route or a changed service rule comes with its test in the same change.

## Don't

- Don't run integration tests against a development database.
- Don't add a test runner or assertion library; `bun:test` covers it.
- Don't cite the suite as proof for code it does not exercise.
