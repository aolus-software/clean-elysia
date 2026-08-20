# Rule: Validation (`src/modules/<name>/schema.ts`)

All HTTP input and output is validated by Elysia's TypeBox. Schemas are declared in the module's
`schema.ts` and wired into the route declaration — never re-validated inside a handler.

This rule covers schema *content* and *naming*. Which schemas a route must declare, and the
`include` array on `commonResponse(...)`, are covered by [openapi.md](./openapi.md).

## Location and imports

- One `schema.ts` per module or sub-module: `src/modules/settings/user/schema.ts`,
  `src/modules/auth/schema.ts`.
- Always `import { t } from "elysia"` — never `@sinclair/typebox` directly.
- No runtime logic in `schema.ts`. It exports schemas and nothing else.
- Schemas are not declared inline in `index.ts`, except a trivial one-off param object
  (`params: t.Object({ id: t.String({ format: "uuid" }) })`).

## Naming

Entity first, then the action, then `Schema`:

- Inputs — `UserCreateSchema`, `UserUpdateSchema`, `PermissionCreateSchema`,
  `UserResetPasswordSchema`
- Data shapes (what the handler puts inside `data`) — `UserListSchema`, `UserDetailSchema`,
  `RoleListSchema`, `HealthCheckDataSchema`
- Auth-flow inputs keep their verb form, since there is no entity — `LoginSchema`,
  `RegisterSchema`, `ForgotPasswordSchema`, `ResetPasswordSchema`, `VerifyEmailSchema`

`src/modules/settings/role/schema.ts` is the outlier (`CreateRoleSchema`, `UpdateRoleSchema`).
Follow the entity-first form for new schemas; don't copy the role module's ordering.

## Field-level requirements

- **Every field gets a `description`**, and every non-obvious field gets at least one `examples`
  entry. Both surface as property docs in `/docs`.
- **Prefer a semantic `format` over a hand-rolled regex**: `t.String({ format: "email" })`,
  `t.String({ format: "uuid" })`, `t.String({ format: "date-time" })`.
- **Length, range, and pattern constraints belong in the schema**, not in the service.
  `t.String({ minLength: 8 })` is schema work; "this email is already taken" is service work.
- **Password fields use the shared pattern** — never a fresh regex:
  ```ts
  import { StrongPassword } from "@default";

  password: t.String({
  	pattern: StrongPassword.source,
  	description: "Password must contain upper, lower, digit and symbol",
  }),
  ```
  Live examples: `src/modules/auth/schema.ts:39`, `src/modules/settings/user/schema.ts:38`.
- **Dates use `t.Date()`** so Elysia owns serialization. Don't accept a bare string for a date.
- **`t.Optional(...)` for "may be absent"; `t.Nullable(...)` for "may be `null`".** These are
  different. Only combine them when the column really is both nullable and optional.

## Enums come from Drizzle, not from a hand-written union

The database schema is the single source of truth. `src/libs/database/postgres/schema/user.ts`
exports three things for the user status:

- `userStatusEnum` — the Drizzle `pgEnum("user_status", [...])`, used by the table definition
- `UserStatus` — a plain const object (`{ ACTIVE: "active", … }`) for TypeBox
- `UserStatusEnum` — the derived TS union type, for repository and service signatures

TypeBox schemas take the const object through the `@database` barrel:

```ts
import { UserStatus } from "@database";
import { t } from "elysia";

status: t.Enum(UserStatus),
```

Never redeclare `t.Union([t.Literal("active"), …])` — it silently drifts from the `pgEnum` and the
migration. When you add a member, it goes in `userStatusEnum` **and** `UserStatus` in the same
change, followed by `bun run db:generate` (see [documentation.md](./documentation.md)).

Note: `src/modules/settings/user/schema.ts` defines `UserStatusSchema = t.Enum(UserStatus)` and
then double-wraps it as `t.Enum(UserStatusSchema)` in most fields. Line 56 has the correct form,
`t.Enum(UserStatus)`. Write the direct form in new code.

## Response schemas

- Wrap the data schema in the envelope with `commonResponse(<DataSchema>, { include: [...] })`, or
  `commonPaginatedResponse(<ItemSchema>, { include: [...] })` for list endpoints. Both come from
  `@utils`. A bare TypeBox schema as `response` is wrong — the handler returns
  `{ status, success, message, data }`, so the schema must describe the envelope.
- Export response-shaped schemas separately from request-shaped ones, even when the fields overlap.
  A request that accepts `password` and a response that must never emit it are two schemas.
- **The response schema is the last guardrail against a leak.** Password hashes, raw reset or
  verification tokens, and internal-only columns are left out. If a repository over-selects, the
  schema is what stops it reaching a client.

## Don't

- Don't validate in the handler. If you are writing `if (!body.email.includes("@"))`, that check
  belongs in the schema.
- Don't reuse an input schema as a response schema to save a few lines.
- Don't put a schema in `index.ts` because it is "only used once" — `schema.ts` is the home.
- Don't declare a field the route neither reads nor returns. The schema is a contract, not a wish
  list.
