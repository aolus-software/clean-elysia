# Rule: Services (`src/modules/<name>/service.ts`)

Services hold the *what* and *why* of a feature. Repositories hold the *how* of data access. Route
handlers are the glue. A service is the only layer allowed to open a transaction.

## Shape — plain object, never a class

```ts
export const RoleService = {
	findAll: async (
		queryParam: DatatableType,
	): Promise<PaginationResponse<RoleList>> => {
		return await RoleRepository().findAll(queryParam);
	},

	create: async (data: { name: string; permission_ids: string[] }) => {
		return await RoleRepository().create(data);
	},
};
```

- Export name is `<Entity>Service` in PascalCase; properties are arrow functions.
- No `this`, no constructor, no inheritance. The one exception in the codebase is `AuthMailService`
  in `@mailer`, which is a class instantiated per call — do not copy that pattern into a module
  service.
- Method names for CRUD are `findAll` / `findOne` / `create` / `update` / `delete`. See
  [services-crud.md](./services-crud.md).

## No HTTP inside a service

A service takes primitives and DTOs and returns primitives and DTOs. No Elysia `Context`, no `set`,
no `body`, no `query` object beyond the already-parsed `DatatableType`. The handler does the HTTP
mapping. A service that reaches for `set.status` has the layering backwards.

## Repository access

Call the factory on **every** call — `RoleRepository().findAll(...)`. Never
`const repo = RoleRepository()` at module scope; the factory pattern exists so a future override
stays possible.

Reach for `db` directly only for a write that would otherwise be a single-use repository wrapper, and
keep it inside a transaction:

```ts
const hashPassword = await Hash.generateHash(newPassword);
await db.transaction(async (tx) => {
	await tx.update(users).set({ password: hashPassword }).where(eq(users.id, user.id));
});
```

Anything reusable belongs in the repository instead. See [repositories.md](./repositories.md).

## Transactions are the service's job

Repositories never open a transaction; they only *accept* one. Wrap anything that writes to two or
more tables in `db.transaction(async (tx) => { ... })` and thread `tx` into each repository call so
they join the same transaction:

```ts
await db.transaction(async (tx) => {
	await UserRepository().create(data, tx);
	await authMailService.sendVerificationEmail(userId, tx);
});
```

A multi-table write outside a transaction leaves the database half-updated on failure.

## Validation is layered

- Shape, format, length, enum membership → TypeBox in `schema.ts`. See [validation.md](./validation.md).
- Anything that needs the database — uniqueness, state transitions, "does this row exist" — → the
  service, throwing an error class from `@errors`.

Never re-check in the service what the schema already guarantees.

## Errors

Throw; never return an error object or a `{ ok: false }` union.

| Situation | Error |
| --------- | ----- |
| Row genuinely missing | `NotFoundError` |
| Input invalid given DB state (duplicate email) | `BadRequestError` with field details |
| Business rule fails after validation | `UnprocessableEntityError` |
| Caller is not permitted | leave it to the guard — do not throw `ForbiddenError` from a service |

`ErrorHandlerPlugin` maps each to its status. See [errors-and-responses.md](./errors-and-responses.md).

## Cache invalidation

When a service mutates user-shaped data, refresh the cache entry `AuthPlugin` reads, or the next
request will authorize against stale roles and permissions:

```ts
await Cache.set(UserInformationCacheKey(userId), updated);
```

Cache keys live in `@cache` — never build one inline.

## Queues and mail

A service produces jobs; a handler never does. Mail goes through `AuthMailService` (which enqueues)
rather than `EmailService.sendEmail` unless the mail must land inside the request. See
[mail.md](./mail.md) and [queue.md](./queue.md).

## Logging

Structured `log` from `@utils`, object first:

```ts
log.info({ userId, email }, "User logged in successfully");
```

Never `console.*`. Never log a token, password, or hash.

## Silent on enumeration-leaky paths

`forgot-password` and `resend-verification` must not reveal whether an email exists. Return early
instead of throwing `NotFoundError`. See `AuthService.forgotPassword`.

## Don't

- Don't import another module's service. Cross-module reuse means the logic belongs in `libs/`.
- Don't put a repository's query logic in the service, or a service's business rules in the
  repository.
- Don't catch an error only to re-throw it unchanged. Catch to translate or to add context.
- Don't open a transaction inside a repository method, and don't call `db.transaction` from a handler.
- Don't return a Drizzle row shape straight out of a service if it carries a password hash. The
  repository should already have selected the columns; check it.
