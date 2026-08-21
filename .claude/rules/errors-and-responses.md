# Rule: Errors and responses (`@utils` `ResponseToolkit`, `@errors`, `ErrorHandlerPlugin`)

The app speaks **one** success envelope and **one** error vocabulary. Handlers build success
responses with `ResponseToolkit`; failures are *thrown* and `ErrorHandlerPlugin` turns them into HTTP.

- Envelope + toolkit: `src/libs/utils/elysia/response.ts` (exported via `@utils`)
- Error classes: `src/libs/errors/` (exported via `@errors`)
- Mapping: `src/libs/plugins/error-handler.plugin.ts`, registered on the root app in `src/server.ts`

## The envelope

`status` appears **inside the body** as well as on the HTTP response — don't omit it from a response
schema and don't assume the body is just `{ success, message, data }`.

```jsonc
// success — ResponseToolkit.success / .created
{ "status": 200, "success": true, "message": "Role list retrieved successfully", "data": { } }

// paginated — ResponseToolkit.paginated
{ "status": 200, "success": true, "message": "…",
  "data": { "data": [], "meta": { "page": 1, "limit": 10, "totalCount": 42 } } }

// error with field detail — 400 / 422
{ "status": 422, "success": false, "message": "…", "errors": [{ "field": "email", "message": "…" }] }

// error without field detail — 401 / 403 / 404 / 429 / 500
{ "status": 404, "success": false, "message": "…", "data": null }
```

`meta` is exactly `{ page, limit, totalCount }` — there is no `perPage` and no `totalPages`. See
`PaginatedResponseSchema` and `ResponseToolkit.paginated`.

## `ResponseToolkit` — data first

Static methods on a class; the **data argument comes first**, message second, status last:

```ts
ResponseToolkit.success(data, message?, status?)      // status: 200 | 201 | 202, default 200
ResponseToolkit.created(data, message?)               // sugar for success(data, message, 201)
ResponseToolkit.paginated(data, meta, message?)       // meta: { page, limit, totalCount }
```

Real call sites in `src/modules/settings/role/index.ts`:

```ts
return ResponseToolkit.success(result, "Role list retrieved successfully", 200);
return ResponseToolkit.success(null, "Role created successfully", 201);
```

Pass `null` as `data` when there is nothing to return — the envelope still needs the key. The
toolkit also exposes `error`, `validationError`, `notFound`, `unauthorized`, `forbidden`, `conflict`,
`tooManyRequests`, `internalError`; **nothing in `src/` calls them, and new code shouldn't** — throw.

## The six error classes

All exported from `@errors`. The status is whatever `ErrorHandlerPlugin` assigns:

| Class                      | File                          | Status | Body shape |
| -------------------------- | ----------------------------- | ------ | ---------- |
| `BadRequestError`          | `bad-request-error.ts`        | 400    | `errors: [{ field, message }]` |
| `UnauthorizedError`        | `unauthorized-error.ts`       | 401    | `data: null` |
| `ForbiddenError`           | `forbidden-error.ts`          | 403    | `data: null` |
| `NotFoundError`            | `not-found-error.ts`          | 404    | `data: null` |
| `UnprocessableEntityError` | `unprocessable-entity-error.ts` | 422  | `errors: [{ field, message }]` |
| `RateLimitError`           | `to-many-request-error.ts`    | 429    | `data: null` |

`to-many-request-error.ts` is misspelled in the repo — that is the real path; don't "fix" it as a
side effect of unrelated work.

`BadRequestError` and `UnprocessableEntityError` take `(message, errors)` — the second argument is
required, so pass `[{ field, message }]` even for a single field:

```ts
throw new BadRequestError("Email already registered", [
	{ field: "email", message: "Email already registered" },
]);
throw new UnauthorizedError("Invalid credentials");
throw new NotFoundError("User not found");
```

All six classes agree with the table: `code`, `toResponse()`, and `ErrorHandlerPlugin` return the
same status. Keep it that way — a class whose `code` disagrees with the status the plugin assigns it
sends callers reading `error.code` somewhere the response never goes. If you add an error class, set
`code` and `toResponse()` to the status the plugin assigns it, and add the branch to
`ErrorHandlerPlugin` in the same change.

## What `ErrorHandlerPlugin` also handles

Beyond the six classes, it owns four framework paths — you never write these branches yourself:

- `code === "VALIDATION"` → 422 with per-field `errors`, each message run through
  `translateValidationMessage` from `@i18n`
- `code === "NOT_FOUND"` → 404 (unmatched route)
- `code === "PARSE"` → 400 with `errors: [{ field: "body", … }]`
- anything else → 500, logged via `log?.error({ error }, "Unhandled error")`

Default messages come from `@i18n` (`t("errors.notFound")`, `t("validation.failed")`, …), so a
thrown error with no message still returns a localized string. A new user-facing message goes in
**both** `src/libs/i18n/locales/{en,id}.json`, then `bun run i18n:keys`.

## Rules

- **Never hand-build the envelope.** `{ status: 200, success: true, data }` written by hand is a
  defect — use `ResponseToolkit`.
- **Never `set.status = 4xx` and return a payload.** Throw instead. Status comes from the toolkit on
  success and `ErrorHandlerPlugin` on failure; two mechanisms competing ships mismatched bodies.
- **Route handlers never build error responses.** They call the service, which throws. The handler
  has no error branch — see [modules.md](./modules.md).
- **Throw the domain error, not the library's.** Catch a driver or third-party failure, log it, and
  re-throw one of the six. Raw `pg` or `bcrypt` messages must not reach a client.
- **Log with structure before re-throwing**, object first, message second:
  ```ts
  catch (error) {
  	log.error({ error, userId }, "Failed to update user");
  	throw new UnprocessableEntityError("Failed to update user", [
  		{ field: "general", message: "Failed to update user" },
  	]);
  }
  ```
- **No secrets in `message` or `errors[]`.** Password hashes, raw tokens, stack traces, SQL — none of
  it. The `errors[]` array is rendered inline by clients.
- **Don't catch and swallow.** Either re-throw a translated error or handle the failure. The one
  deliberate exception is enumeration-leaky paths (forgot-password, resend-verification), which
  return early rather than revealing whether an account exists.
- **`include` must match reality.** The codes listed in `commonResponse(..., { include: [...] })`
  have to be the ones the route can actually produce — 403 only if a guard runs, 404 only if a param
  can miss. See [openapi.md](./openapi.md).
