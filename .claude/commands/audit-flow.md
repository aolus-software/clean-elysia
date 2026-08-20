---
name: audit-flow
description: "Read-only whole-codebase audit of this Elysia backend for auth/token flow contradictions, RBAC gaps, soft-delete correctness, secrets at rest, i18n parity, dead code/validation, shared-code placement, response-contract drift, and doc drift. Writes explained findings (what it is · why · what it costs · what to do) to docs/audit-findings.md. Never modifies application code."
risk: safe
source: local
---

# Audit Flow

Run a structured, **read-only** audit of this backend and record the results in
`docs/audit-findings.md`. This command **never changes application code, schemas, migrations, seeds,
or config** — its only output is the findings document.

`$ARGUMENTS` (optional) narrows scope to specific categories or paths (e.g. `audit-flow auth rbac`,
`audit-flow src/modules/settings`). **With no arguments, sweep the entire codebase** as defined under
"What a full sweep covers" — not a sample, not the modules that changed recently.

## How to run it

1. **Read the ground truth first**: `CLAUDE.md`, every `.claude/rules/*.md`, and
   `.claude/rules/audit-findings.md` in particular — that is the writing contract, and it is read
   before a single finding is written. These define the intended behaviour that findings are measured
   against: a finding is always "code vs stated intent", never "code vs the auditor's taste". Where
   no rule states an intent, say so in the finding rather than inventing one.
2. **Build the inventory before dispatching anything.** Enumerate what exists so coverage is a fact
   rather than a hope: every folder under `src/modules/`, every bucket under `src/libs/`, every table
   in `src/libs/database/postgres/schema/`, every migration in
   `src/libs/database/postgres/migrations/`, and every queue/worker pair in `src/bull/`. Keep this
   list — it is what the report's Coverage section is written from.
3. **Dispatch parallel read-only `Explore` subagents** — one per category below, each given its slice
   of the inventory so every file has an owner. Do not read serially in the main thread. If a
   category is too large for one agent, split it by module and say so in Coverage.
4. **Each subagent returns evidence, not prose**: `file:line` for every claim, the intended behaviour
   per the rules, what the code actually does, the gap, and whether it traced the path end to end
   (**CONFIRMED**) or is guessing (**SUSPECT**, plus what would settle it).
5. **Write the findings up yourself, in the main thread.** A subagent's terse notes are raw material.
   Every finding gets the five blocks required by `.claude/rules/audit-findings.md`:

   > **Where** (`file:line`) · **What this is** · **Why this can happen** · **What it costs** ·
   > **What we should do**

   written so someone who has never opened that file understands the problem without reading code.
   Tag each 🔴 bug · 🟠 inconsistency · 🟡 hygiene · 📄 doc, by consequence, never by effort.
6. **Write the Coverage section** — what was reached, and what was deliberately not. A category with
   no findings says so and names what was checked.
7. **Write "Top priorities" last**, ordered security → data integrity → correctness → hygiene/doc, in
   the plainest language in the document.
8. **Report a short summary to the user. Do not fix anything** — fixes are a separate, explicitly
   requested step.

## What a full sweep covers

Everything below is in scope for an unscoped run. Note this project keeps its shared libraries
**inside** `src/` — there is no top-level `libs/`.

| Area | Includes |
|---|---|
| `src/index.ts`, `src/base.ts`, `src/bootstrap.ts` | boot order, the `baseApp` plugin chain (`RequestPlugin` → `LoggerPlugin` → `PerformancePlugin` → `DiPlugin` → `BodyLimitPlugin` → `SecurityPlugin`), DI registrations, `DocsPlugin` + `ErrorHandlerPlugin` composition, `.listen()` |
| `src/modules/auth/**` | login, register, email verification, forgot/reset password, and their TypeBox schemas |
| `src/modules/settings/**` | `user`, `role`, `permission`, `select-option` — the RBAC catalog every guard depends on |
| `src/modules/profile/**`, `src/modules/home/**` | self-service surface and the unauthenticated surface; what each discloses |
| `src/libs/plugins/**` | `AuthPlugin` (token verify + Redis cache-aside), `SecurityPlugin`, `BodyLimitPlugin`, `DocsPlugin`, `ErrorHandlerPlugin`, and the DI `container` |
| `src/libs/guards/**` | `PermissionGuard`, `RoleGuard` — including the `superuser` short-circuit |
| `src/libs/repositories/**` | `user`, `role`, `permission`, `forgot-password` factories: soft-delete filters, sort/filter allow-listing, transaction threading |
| `src/libs/database/postgres/**` | `schema/` (`users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `email_verifications`, `password_reset_tokens`), `migrations/`, `seed/` |
| `src/libs/database/redis/**`, `src/libs/cache/**` | cache keys, TTLs, and invalidation on write |
| `src/libs/database/clickhouse/**` | optional analytics client and its migration runner |
| `src/libs/errors/**`, `src/libs/utils/**` | the error classes and their status mapping; `Hash`, `Encrypt`, `log`, `ResponseToolkit`, `DatatableToolkit` |
| `src/libs/config/**` | `env.config.ts` validation and the derived config objects |
| `src/libs/i18n/**` | `locales/en.json` and `locales/id.json` parity |
| `src/bull/**` | `send-mail-queue` / `send-mail-worker`: retry, re-throw, failure logging |
| repo root | `Makefile` (including the Docker suite), `ecosystem.config.cjs`, `.env.example`, `Dockerfile`, `docker-compose.yml`, `package.json` scripts, `.husky/`, `.github/workflows/ci.yml` |

**Deliberately out of scope** (state this in Coverage): `node_modules/`, `dist/`, `storage/`,
lockfiles, and `.agents/skills/` (a vendored bundle, not this project's code — `.claude/skills` is a
symlink to it, so do not sweep it twice).

Coverage is not optional. If time or context forces a partial sweep, **say which areas were not
reached** rather than letting silence imply they were clean.

## Categories to cover

1. **Auth & token flows** — the order and idempotency of register → verify-email → login, and
   forgot-password → reset-password; whether a consumed or expired token row is invalidated rather
   than left reusable; whether issuing a second token revokes the first; token lifetimes taken from
   `@default` rather than inline numbers; what `AuthPlugin` puts on the context.
   **Known today:** `password_reset_tokens` has **no `expired_at` column** and `AuthService.resetPassword`
   performs no expiry check, while the sibling `verifyEmail` does — confirm and record it.
2. **Access control** — every route against its `beforeHandle`: a route under `AuthPlugin` with no
   `PermissionGuard.canActivate` / `RoleGuard.canActivate` call; a permission string that no seeded
   permission matches; the `superuser` short-circuit in `PermissionGuard`; and any authenticated route
   that can act on an id other than the caller's without a check. Permission strings here are
   space-separated (`"user list"`), not colon-separated.
3. **Ownership & self-service boundaries** — `src/modules/profile/**` and any `settings/user` route
   taking an arbitrary `:id`. A privilege-escalation path (a user granting themselves a role, or
   resetting another user's password) is 🔴 and sorts first.
4. **Soft delete & data integrity** — every read path on `users` starting from
   `isNull(users.deleted_at)`, no hard `DELETE` on a soft-deletable table, unique constraints the code
   assumes actually declared, cascade behaviour on `user_roles` / `role_permissions`, and transactions
   opened by the **service** via `db.transaction(...)` and never by a repository.
5. **Secrets & sensitive data at rest** — password hashes, JWT secrets, reset/verification tokens, and
   `APP_KEY` absent from logs, responses, TypeBox response schemas, OpenAPI examples, and repository
   `columns` selections; `Hash` used for passwords; env read through `@config`, never `process.env`.
6. **i18n parity** — `locales/en.json` and `locales/id.json` holding the same keys with the same
   placeholders; any user-facing literal that bypassed the translator; keys referenced in code but
   missing from a catalogue. `bun run i18n:keys` regenerates the key types.
7. **Response-contract completeness** — routes whose `response: commonResponse(..., { include: [...] })`
   omits a status the handler can actually return; a module missing `detail.tags`; a public module that
   forgot `security: []`; a route with no `summary`/`description`; `ResponseToolkit` bypassed by a
   hand-built payload. See `.claude/rules/openapi.md`.
8. **Dead code, unused fields & validation** — TypeBox fields the service never reads, missing
   `description`/`examples`, enum unions redeclared instead of reused from `@database`, and sort/filter
   allow-lists (`validateOrderBy`) that drifted from the schema.
9. **Shared-code placement** — anything in `src/modules/` that a second module needs (it belongs in
   `src/libs/<bucket>/`), cross-module relative imports, and **a bucket export missing from its
   `index.ts`**, which silently breaks the alias. See `.claude/rules/shared-code.md`.
10. **Caching & queues** — cache keys that can collide across users; a cached `UserInformation` not
    invalidated when roles or permissions change (a stale permission cache is a **security** finding,
    not a performance one); TTL units; and mail jobs that can fail the primary request instead of
    being fire-and-forget. See `.claude/rules/queue.md`.
11. **Data model & migrations** — `schema/` versus the applied migrations, a schema change with no
    generated migration, an edited already-applied migration, and indexes missing on columns the
    repositories filter or sort by.
12. **Documentation drift** — `CLAUDE.md`, `README.md`, `docs/*`, and `.claude/rules/*` claims versus
    the code: env var names, module names, permission strings, path aliases, `Makefile` targets, and
    the PM2 app name in `ecosystem.config.cjs`. A shipped pattern with no rule is itself a 📄 finding
    (`.claude/rules/documentation.md`).

## Rules for this command

- **Read-only.** If the audit surfaces a bug or rule contradiction, **report it — do not act on it**
  (`.claude/rules/contradiction-halt.md`). The findings document is the one file this command writes.
- **Writing format is governed by `.claude/rules/audit-findings.md`** — the five blocks, plain
  language, severity by consequence, CONFIRMED-vs-SUSPECT honesty, document layout, permanent finding
  numbers, and how a resolved finding is marked. Read it before writing the report.
- **Prefer updating the existing `docs/audit-findings.md`** over creating a new file — one living
  record. Never renumber an existing finding; append new ones.
- **Cite `file:line` for every finding.** No finding without a location.
- **Explain, don't just point.** A finding a reader must open the code to understand has not been
  written yet.
- **There is no test runner configured.** Do not report test results, and treat an unguarded
  invariant with no test as a finding in its own right rather than something you can verify by running.
