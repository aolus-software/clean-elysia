# Rule: Elysia plugins (`src/libs/plugins/`)

A plugin is a named Elysia instance that adds cross-cutting behaviour — request id, logging, auth,
security headers, error mapping. Plugins are re-exported from `src/libs/plugins/index.ts` and
consumed through `@plugins`.

## The files that exist

| File                       | Export               | Elysia `name`     |
| -------------------------- | -------------------- | ----------------- |
| `auth.plugin.ts`           | `AuthPlugin`         | `"auth"`          |
| `body-limit.plugin.ts`     | `BodyLimitPlugin`    | `"body-limit"`    |
| `di.plugin.ts`             | `DiPlugin`           | `"di"`            |
| `docs.plugin.ts`           | `DocsPlugin`         | `"docs"`          |
| `error-handler.plugin.ts`  | `ErrorHandlerPlugin` | `"error-handler"` |
| `locale.plugin.ts`         | `LocalePlugin`       | `"locale"`        |
| `logger.plugin.ts`         | `LoggerPlugin`       | — (see below)     |
| `performance.plugin.ts`    | `PerformancePlugin`  | `"performance"`   |
| `request-id.plugin.ts`     | `RequestPlugin`      | `"request-id"`    |
| `security.plugin.ts`       | `SecurityPlugin`     | `"security"`      |

`src/libs/plugins/core/` is not a plugin — it holds the DI `container` (see [di.md](./di.md)),
re-exported through the same barrel.

`LoggerPlugin` is the odd one out: it is not a `new Elysia(...)` at all but
`wrap(log, { autoLogging: true, customProps })` from `@bogeychan/elysia-logger`, so it declares no
`name`. Its `customProps` reads `ctx.requestId`, which is why `RequestPlugin` has to run before it.

Two naming facts worth internalising before you grep for something:

- **The `name` is kebab-case with no `-plugin` suffix.** It is `"security"`, not
  `"security-plugin"`. Elysia dedupes `.use()` calls by this string, so it must be unique across the
  whole app — including module names.
- **`request-id.plugin.ts` exports `RequestPlugin`, not `RequestIdPlugin`.** The file, the export,
  and the `name` all differ. Don't guess the import.

## Shape

```ts
export const SecurityPlugin = new Elysia({ name: "security" })
	.use(cors(...))
	.use(helmet(...));
```

- Filename is `<concern>.plugin.ts`, kebab-case; the export is `PascalCasePlugin`.
- Add every new plugin to `src/libs/plugins/index.ts` — the barrel is what makes `@plugins` resolve
  it ([shared-code.md](./shared-code.md)).
- Plugins may `.use()` other plugins. `AuthPlugin` composes `jwt(JWT_CONFIG)` and `bearer()`;
  `ErrorHandlerPlugin` composes `LoggerPlugin`.
- Plugins do **not** register routes. The one exception is `DocsPlugin`, which owns `/docs` and
  `/docs/openapi.json` by design.

## Composition — `baseApp` and the root app

`src/base.ts` is the global stack, in this exact order:

```ts
export const baseApp = new Elysia({ name: "base-app" })
	.use(RequestPlugin)
	.use(LocalePlugin)
	.use(LoggerPlugin)
	.use(PerformancePlugin)
	.use(DiPlugin)
	.use(BodyLimitPlugin)
	.use(SecurityPlugin);
```

The order is a dependency chain, not a preference: `RequestPlugin` first so a request id exists for
`LoggerPlugin` to attach, `LocalePlugin` before anything that emits a translated string, `DiPlugin`
in place before a handler resolves from the container. Don't reorder without tracing what reads what.

`src/server.ts` composes the root instance separately:

```ts
const app = new Elysia()
	.use(LocalePlugin)
	.use(DocsPlugin)
	.use(ErrorHandlerPlugin)
	.use(bootstraps)
	.listen(...);
```

`DocsPlugin` and `ErrorHandlerPlugin` live here, not in `baseApp` — the error handler is declared
`.as("global")` so its `onError` covers every module mounted under `bootstraps`. `LocalePlugin`
appears in both places; Elysia's name-based dedupe makes the second `.use` a no-op.

**A new global plugin goes in `baseApp`**, not into each module by hand. A plugin that must wrap the
whole app including the docs and error layers goes in `src/server.ts`.

## `AuthPlugin` is opt-in, and it does not carry `baseApp`

`AuthPlugin` is deliberately absent from `baseApp` — authentication is per route group, not global.
It verifies the bearer JWT, loads the user cache-aside via `UserInformationCacheKey`, and derives
`user: UserInformation` onto the context with `{ as: "scoped" }`.

In this repo a module composes **one or the other**, never both:

- `.use(baseApp)` — public modules: `src/modules/auth/index.ts`, `src/modules/home/index.ts`
- `.use(AuthPlugin)` — protected modules: `src/modules/profile/index.ts` and every module under
  `src/modules/settings/`

`AuthPlugin` does not itself `.use(baseApp)`, so it is fair to ask whether the protected modules get
the global stack at all. They do — but only because every hook inside `baseApp` declares
`{ as: "global" }`.

That declaration is load-bearing and easy to omit. A bare `.derive(...)` /
`.onBeforeHandle(...)` / `.onAfterHandle(...)` is scoped **local** by Elysia, meaning it applies only
to routes declared *inside that plugin instance* — which, for a plugin that declares no routes, is
none at all. A locally-scoped `RequestPlugin` puts no `requestId` on any handler, a locally-scoped
`BodyLimitPlugin` rejects nothing, and a locally-scoped `PerformancePlugin` never times anything. All
of it fails silently.

So: **when you add a lifecycle hook or a derive to a plugin in `baseApp`, pass `{ as: "global" }`**,
and verify it by request rather than by reading — a 200KB body against the 100KB limit should return
413, and `requestId` / `startedAt` / `container` should be present on handlers in modules that chain
`baseApp` *and* in modules that do not.

`SecurityPlugin`'s contents (cors, helmet, rate limit) are exempt — those libraries set their own
scope and apply app-wide regardless.

Authentication proves *who*; it does not decide *whether*. Every protected route still needs
`PermissionGuard.canActivate(user, [...])` or `RoleGuard.canActivate(user, [...])` in its
`beforeHandle` ([modules.md](./modules.md)).

## Don't

- Don't hold per-request state on a plugin. Instantiated middleware (helmet, cors, rate limit) is
  fine; a module-level mutable variable is not. Per-request data goes on the context via `.derive`.
- Don't put business logic in a plugin. Reading the current user from `UserRepository` is plugin
  work; deciding whether to send an email is not.
- Don't build an error response inside a plugin. Throw one of the six classes from `@errors` and let
  `ErrorHandlerPlugin` map it — see [errors-and-responses.md](./errors-and-responses.md).
- Don't reuse an existing `name`. Elysia silently drops the second `.use()`, and the symptom is a
  plugin that "does nothing" for no visible reason.
- Don't replace the DI container from a plugin. A plugin may resolve from it and attach the result to
  context; the container stays the source of truth.
