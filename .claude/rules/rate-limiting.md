# Rule: Rate limiting

Rate limiting is **global and always on**. `rateLimit(...)` from `elysia-rate-limit` is registered inside `SecurityPlugin` (`src/libs/plugins/security.plugin.ts`), and `SecurityPlugin` is the last `.use(...)` in `baseApp` (`src/base.ts`). Every request that reaches the app passes through the bucket. There is **no per-route opt-in and no per-route opt-out** — none exists to be used.

## The actual configuration

```ts
rateLimit({
	max: 100,
	duration: 60 * 1000,
	headers: true,
	errorResponse: new RateLimitError(),
}),
```

100 requests per 60 seconds per client, with `RateLimit-*` response headers on. `headers: true` matters: a client can see its own budget, so do not paper over a 429 with a retry loop when the headers already say to back off.

**These numbers are hardcoded in the plugin.** This is a real divergence from the NestJS siblings, which drive their throttler from `THROTTLER_TTL` / `THROTTLER_LIMIT`. There is no such env var here. Changing the limit means editing `security.plugin.ts` — do not write a rule, a doc, or a `.env.example` entry that implies otherwise.

If the limit ever genuinely needs to differ per environment, the right move is to add it to `@config` (alongside `AppConfig`, `CORSConfig`, …) and read it in the plugin — one named source, not numbers scattered across call sites. Until someone does that, the hardcoded pair is the whole story.

## The 429

`errorResponse` is an instance of `RateLimitError`, exported from `@errors` and defined at `src/libs/errors/to-many-request-error.ts` — yes, the filename is misspelled; that is the real path, don't "fix" it in an import and break the build. Its `toResponse()` emits the standard envelope:

```json
{ "status": 429, "success": false, "message": "rate-limited" }
```

Note that this is produced by the plugin directly, not by `ErrorHandlerPlugin`, so throwing `RateLimitError` from your own code is **not** how you get a 429 — `ResponseToolkit.tooManyRequests(...)` is the tool for a deliberate 429 from a handler.

## Documenting it

`commonResponse(schema, { include: [...] })` supports `429`, so a route that documents throttling lists it there. No route currently does. That is defensible — the limit applies uniformly and documenting it 40 times adds noise — but be honest about the consequence: **any** route in this app can return 429, whether or not its OpenAPI block mentions it. If you add `429` to one route's `include`, have a reason specific to that route.

`commonPaginatedResponse` has **no** 429 branch. Passing `429` in its `include` silently does nothing; don't.

## Credential endpoints

`POST /auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, and `/auth/resend-verification` are unauthenticated and enumerable. Their policy may be **tightened, never loosened**.

There is no override mechanism wired up today. Tightening one of these means composing a scoped plugin — a small named Elysia instance carrying its own `rateLimit({ max, duration, errorResponse })`, `.use(...)`d by the auth module only:

```ts
export const AuthRateLimitPlugin = new Elysia({ name: "auth-rate-limit" }).use(
	rateLimit({ max: 10, duration: 60 * 1000, errorResponse: new RateLimitError() }),
);
```

It stacks **on top of** the global bucket rather than replacing it, which is the behaviour you want here. Name the numbers as constants and comment why the route differs.

## Don't

1. Don't edit the global `rateLimit(...)` to accommodate one noisy route. Scope a plugin.
2. Don't loosen a credential endpoint.
3. Don't register `rateLimit(...)` a second time at app level — plugin dedup is by `name`, and an anonymous second registration double-counts every request.
4. Don't claim a `THROTTLER_*` env var exists.
5. Don't `throw new RateLimitError()` expecting the error handler to render it. Use `ResponseToolkit.tooManyRequests(...)`.
6. Don't rename `to-many-request-error.ts` as a drive-by. If it gets fixed, it is its own change with the `@errors` barrel and every import updated together.
