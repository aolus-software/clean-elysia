# Rule: Drizzle schema (`src/libs/database/postgres/schema/`)

The schema is the source of truth for the database. `drizzle.config.ts` points `schema` at
`./src/libs/database/postgres/schema/index.ts` and writes migrations to
`./src/libs/database/postgres/migrations`.

## File and naming conventions

- One file per domain area: `user.ts`, `email-verification.ts`, `password-reset-token.ts`. There is
  **no `.schema.ts` suffix** — that is the Nest sibling's convention, not this one.
- Closely-coupled tables share a file: all four RBAC tables (`roles`, `permissions`,
  `rolePermissions`, `userRoles`) live in `rbac.ts` with their relations.
- Table exports are **plain camelCase plurals with no suffix**: `users`, `roles`, `permissions`,
  `rolePermissions`, `userRoles`, `emailVerifications`, `passwordResetTokens`. Do not add the `_table`
  suffix the Nest repos use.
- Column names are `snake_case`: `created_at`, `email_verified_at`, `deleted_at`, `user_id`.

## Enums — three exports, one source

A `pgEnum` alone is not usable from TypeBox, so each enum gets three exports:

```ts
export const userStatusEnum = pgEnum("user_status", [
	"active",
	"inactive",
	"suspended",
	"blocked",
]);

// Export enum object for Typebox
export const UserStatus = {
	ACTIVE: "active",
	INACTIVE: "inactive",
	SUSPENDED: "suspended",
	BLOCKED: "blocked",
} as const;

export type UserStatusEnum = (typeof UserStatus)[keyof typeof UserStatus];
```

- `userStatusEnum` — the column type, used in the table definition.
- `UserStatus` — the const object TypeBox schemas consume as `t.Enum(UserStatus)`.
- `UserStatusEnum` — the TS union, used in service and repository signatures.

All three must list the same values. Adding a value means editing all three **and** generating a
migration, because Postgres enums are real types.

## Standard columns

```ts
export const users = pgTable(
	"users",
	{
		id: uuid().primaryKey().defaultRandom(),
		name: varchar({ length: 255 }).notNull(),
		email: varchar({ length: 255 }).notNull(),
		status: userStatusEnum().default("active").notNull(),
		remark: varchar({ length: 255 }),
		password: varchar({ length: 255 }).notNull(),
		email_verified_at: timestamp(),
		deleted_at: timestamp(),
		created_at: timestamp().defaultNow().notNull(),
		updated_at: timestamp()
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("users_email_deleted_at_status_index").on(
			table.email,
			table.deleted_at,
			table.status,
		),
	],
);
```

- Primary key: `uuid().primaryKey().defaultRandom()`.
- `created_at`: `timestamp().defaultNow().notNull()`.
- `updated_at`: `timestamp().defaultNow().$onUpdate(() => new Date()).notNull()`. The `$onUpdate` is
  what keeps it current — a table without it silently never updates the column.
- Soft delete: `deleted_at: timestamp()` (nullable, no default) on any entity that is soft-deleted,
  and every read filters `isNull(<table>.deleted_at)` — see [repositories.md](./repositories.md).
- Add a composite index covering the columns queried together. `users` indexes
  `(email, deleted_at, status)` because that is exactly what the auth lookup filters on.

## Foreign keys and cascade

```ts
user_id: uuid()
	.notNull()
	.references(() => users.id),
```

State the cascade behaviour deliberately. `password_reset_tokens.user_id` and
`email_verifications.user_id` currently reference `users.id` with **no** `onDelete`, so the default
(`NO ACTION`) applies — deleting a user row outright would fail. That is survivable only because users
are soft-deleted; do not rely on it for a new table. Pass
`.references(() => users.id, { onDelete: "cascade" })` when the child has no meaning without the
parent.

## Token tables need expiry and single-use

A token table carries at minimum `token`, `user_id`, and `expired_at`, and the consuming service must
compare `expired_at` against now. Both `email_verifications` and `password_reset_tokens` do this —
the latter since 2026-08-20, when the column and the check in `AuthService.resetPassword` were added.

**Set the expiry by calling a lifetime function, never by reading a constant.** The helpers in
`src/libs/default/token-lifetime.ts` are functions —
`verificationTokenLifetime()`, `resetPasswordLifetime()` — because they used to be module-scope
constants, which froze the expiry at "process start + 1 hour" and made every token minted after the
first hour of uptime already expired on arrival. A `Date` computed at module scope is almost always
that bug.

Still open for new tables: prefer a unique index on `token` and a `used_at` column. Deleting the row
after consumption (the current approach in both tables) works but loses the audit trail, and a failed
delete leaves the token live.

## Relations

Every table gets a sibling `<entity>Relations` export so the relational query API works:

```ts
export const usersRelations = relations(users, ({ many }) => ({
	email_verifications: many(emailVerifications),
	password_reset_tokens: many(passwordResetTokens),
	user_roles: many(userRoles),
}));
```

The relation keys are what `db.query.users.findMany({ with: { user_roles: true } })` accepts, so they
are part of the repository's contract — renaming one is a breaking change.

## Registration — the step that is easy to miss

`src/libs/database/postgres/schema/index.ts` does three things, and a new table needs all three:

1. `export * from "./<file>"` so the table is importable from `@database`.
2. The table added to the `schema` object under its relational-query name.
3. The `*Relations` export added to the same `schema` object.

```ts
export const schema = {
	// Tables
	users,
	roles,
	// ...

	// Relations
	usersRelations,
	rolesRelations,
	// ...
};
```

`db` is typed from this object. A table missing from it is invisible to `db.query.*` — the failure is
a type error at the call site, not at the schema.

## Migrations

```
make db-generate     # drizzle-kit generate — writes a new SQL file under migrations/
make db-migrate      # drizzle-kit migrate — applies pending migrations
make reset           # db-generate + db-migrate + db-seed
make fresh           # db-drop + db-push + db-seed — DESTRUCTIVE
```

- Generate and review the SQL before applying it. Check for dropped columns, narrowed types, and
  anything that loses data.
- Never hand-edit a migration that has already been applied. Add a new one.
- `db-push` skips the migration file entirely and syncs the schema directly — development only, never
  against a shared database.
- Seeds live in `src/libs/database/postgres/seed/`. Changing the RBAC catalogue means editing
  `rbac.seed.ts`, and every guard string must still match — see [rbac.md](./rbac.md).

## Don't

- Don't put a query in a schema file. Schema files declare tables and relations only.
- Don't add a table without registering it in the `schema` object.
- Don't add an enum value in one of the three exports and not the others.
- Don't create a soft-deletable table without `deleted_at`, or a non-soft-deletable one with it.
- Don't add a token table without an expiry column.
