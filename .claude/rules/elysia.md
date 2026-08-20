# Rule: Elysia app structure and layering

The framework-level contract: what each layer is allowed to do, what already exists, and where the global stack lives. The per-file detail is in `modules.md` (routes, schemas, services) and `repositories.md` (queries) — this rule is the shape they fit into.

## Layering

```
route handler (index.ts) -> service.ts -> repository -> DB
```

- **Handler** does HTTP and nothing else: destructure the context, call **one** service method, wrap the result in `ResponseToolkit`. Authorization goes in `beforeHandle`, not the body (see `rbac.md`).
- **Service** owns business logic: state-dependent validation, transactions, cache invalidation, queue dispatch. It is the only layer that opens a transaction.
- **Repository** owns Drizzle queries and accepts an optional `tx?: DbTransaction` — it never opens a transaction of its own.

**Never skip a layer.** A handler does not import `db` to run a query; a repository does not decide business rules. The one deliberate exception in the tree is `src/modules/home/index.ts`, whose health route runs `db.execute("SELECT 1")` — a liveness probe, not a query, and not a precedent.

A handler that calls two services is a smell, but it is the *only* place allowed to; cross-feature orchestration never lives in a service that belongs to one feature.

## Services are objects, repositories are factories

Services export a plain object literal — `export const UserService = { ... }`. No classes, no `this`, no constructors, no inheritance. The single class in the service layer is `AuthMailService` (see `mail.md`), and it is a class for historical reasons, not as a model.

Repositories export a factory — `export const UserRepository = () => ({ ... })` — and callers invoke it **per call**: `await UserRepository().getDetail(id)`. Don't hoist it to a module-level const.

## Reuse before you build

Before writing a helper, a guard, a constant, or a response shape, check whether it already exists. It very likely does:

| Alias | Already there |
| --- | --- |
| `@utils` | `ResponseToolkit`, `DatatableToolkit`, `commonResponse`, `commonPaginatedResponse`, `Hash`, `EncryptionToolkit`, `StrToolkit`, `DateToolkit`, `NumberToolkit`, `log` |
| `@plugins` | `AuthPlugin`, `DiPlugin`, `DocsPlugin`, `ErrorHandlerPlugin`, `LocalePlugin`, `LoggerPlugin`, `PerformancePlugin`, `RequestPlugin`, `SecurityPlugin`, `BodyLimitPlugin`, `container` |
| `@guards` | `PermissionGuard`, `RoleGuard` (both `static canActivate(user, [...])`) |
| `@errors` | `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `UnprocessableEntityError`, `RateLimitError` |
| `@default` | `StrongPassword`, `paginationLength`, `defaultSort`, `maxUploadFile`, `allowedFileMimeTypes`, `allowedImageMimeTypes`, token lifetimes |
| `@cache` | `Cache` (`get`/`set`/`del`), `UserInformationCacheKey` |
| `@types` | `DatatableType`, `PaginationResponse`, `EmailOptions`, and the per-entity DTOs |

If your thing is genuinely new and used from more than one place, it goes into a `src/libs/` bucket, not into a module — see `shared-code.md`.

## Config

Read configuration only through `@config`: `AppConfig`, `DatabaseConfig`, `JWT_CONFIG`, `MailConfig`, `CORSConfig`, `RedisConfig`, `clickhouseConfig`. `env` is validated once in `src/libs/config/env.config.ts` and everything else derives from it.

**Never touch `process.env` outside `src/libs/config/`.** If a value you need is not on a config object, add it there — one named field, typed — rather than reading the raw variable at the call site.

## The global stack belongs to `baseApp`

`baseApp` (`src/base.ts`) composes the cross-cutting plugins in order: `RequestPlugin`, `LocalePlugin`, `LoggerPlugin`, `PerformancePlugin`, `DiPlugin`, `BodyLimitPlugin`, `SecurityPlugin`. Anything global — CORS, helmet, rate limiting, request id, locale resolution, body limits, DI — is already there and is configured **once**.

Do not add a global concern from inside a feature module. Elysia dedups plugins by the `name` passed to `new Elysia({ name })`, so a named plugin `.use`d twice is applied once — but an **anonymous** instance is not deduped and will run twice. That is how you end up double-counting a request against the rate limit bucket, or logging every request twice. Give every plugin you write a `name` (`plugins` in `src/libs/plugins/`).

Modules compose `.use(baseApp)` for public surfaces or `.use(AuthPlugin)` for protected ones — never both on the same instance.

## Sibling rules

`modules.md` (the three-file module layout) · `repositories.md` (queries, `tx`, soft delete) · `services.md` (business logic) · `shared-code.md` (which `libs/` bucket) · `di.md` (when the container instead of an import) · `rbac.md` (guards) · `openapi.md` (route `detail` and `commonResponse`) · `queue.md` (BullMQ) · `i18n.md` · `mail.md` · `rate-limiting.md` · `clean-code.md`

When this rule and a layer rule disagree on a detail, the layer rule is more specific and wins.
