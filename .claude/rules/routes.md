# Rule: Route structure and the live route map

## Convention: flat, resource-named, composed by prefix

There is no global prefix and no URL versioning. A route's full path is the concatenation of the
`prefix` on each Elysia instance it passes through: `SettingsModule` (`/settings`) composes
`RoleModule` (`/roles`), so the list route is `GET /settings/roles`.

Resource segments are plural and kebab-case (`/users`, `/roles`, `/permissions`, `/select-options`).
The module **folder** is singular (`src/modules/settings/user/`) while its route prefix is plural
(`/users`) — that mismatch is the existing convention; follow it rather than renaming one side.

Access is enforced by the per-route `beforeHandle`, never by the path. `/settings/**` is not a
security boundary. See [rbac.md](./rbac.md).

## Method conventions

| Operation | Verb + path | Body status |
| --------- | ----------- | ----------- |
| list      | `GET /<resource>` | 200 |
| create    | `POST /<resource>` | 201 |
| detail    | `GET /<resource>/:id` | 200 |
| update    | `PATCH /<resource>/:id` | 200 |
| delete    | `DELETE /<resource>/:id` | 200 |

**Use `PATCH`, never `PUT`.** A sub-resource action gets a trailing segment on the id —
`POST /settings/users/:id/reset-password` — and keeps the parent resource's permission unless the
action genuinely warrants its own (see [rbac.md](./rbac.md) on privilege-granting routes).

Note the list and create routes pass `""` as the path, not `"/"`, because the prefix already carries
the segment. Match that — `"/"` would produce a trailing slash.

## Current route map

Guard column is the `beforeHandle` contents. "—" means no guard: legitimate only for public routes
and for routes that act on the caller's own identity.

```
# Home (src/modules/home) — tags ["General"], baseApp, security: []
GET    /                                             —   public
GET    /health                                       —   public
GET    /live                                         —   public

# Auth (src/modules/auth, prefix /auth) — tags ["Authentication"], baseApp, security: []
POST   /auth/login                                   —   public
POST   /auth/register                                —   public
POST   /auth/resend-verification                     —   public
POST   /auth/verify-email                            —   public
POST   /auth/forgot-password                         —   public
POST   /auth/reset-password                          —   public

# Profile (src/modules/profile, prefix /profile) — tags ["Profile"], AuthPlugin
GET    /profile                                      —   own identity
PATCH  /profile                                      —   own identity

# Settings / Users (prefix /settings/users) — tags ["Settings/Users"], AuthPlugin
GET    /settings/users                               PermissionGuard ["user list"]
POST   /settings/users                               PermissionGuard ["user create"]
GET    /settings/users/:id                           PermissionGuard ["user detail"]
PATCH  /settings/users/:id                           PermissionGuard ["user edit"]
DELETE /settings/users/:id                           PermissionGuard ["user delete"]
POST   /settings/users/:id/reset-password            RoleGuard ["superuser"]
POST   /settings/users/:id/send-verification-email   PermissionGuard ["user create"]
POST   /settings/users/:id/send-reset-password-email PermissionGuard ["user create"]

# Settings / Roles (prefix /settings/roles) — tags ["Settings/Roles"], AuthPlugin
GET    /settings/roles                               PermissionGuard ["role list"]
POST   /settings/roles                               PermissionGuard ["role create"]
GET    /settings/roles/:id                           PermissionGuard ["role detail"]
PATCH  /settings/roles/:id                           PermissionGuard ["role edit"]
DELETE /settings/roles/:id                           PermissionGuard ["role delete"]

# Settings / Permissions (prefix /settings/permissions) — tags ["Settings/Permissions"], AuthPlugin
GET    /settings/permissions                         PermissionGuard ["permission list"]
POST   /settings/permissions                         PermissionGuard ["permission create"]
GET    /settings/permissions/:id                     PermissionGuard ["permission detail"]
PATCH  /settings/permissions/:id                     PermissionGuard ["permission edit"]
DELETE /settings/permissions/:id                     PermissionGuard ["permission delete"]

# Settings / Select Options (prefix /settings/select-options) — tags ["Settings/Select Options"], AuthPlugin
GET    /settings/select-options/permissions          RoleGuard ["superuser"]
GET    /settings/select-options/roles                RoleGuard ["superuser"]
```

**Keep this map current.** Adding, renaming, or re-gating a route updates this table in the same
change — that is [documentation.md](./documentation.md).

## Known gaps in the current map

- **Resolved 2026-08-20:** `PATCH /settings/roles/:id` used to require `"role update"`, which
  `rbac.seed.ts` never produces — so only a `superuser` (who bypasses the guard) could update a role
  and an `admin` holding all 15 seeded permissions got a 403. It now reads `"role edit"`, matching
  every sibling route and the seed. Kept here as the worked example of why guard strings are checked
  against the seed: it failed *closed*, so nothing broke loudly and it survived for a long time.
- The three `user create`-gated sub-resource routes on `/settings/users/:id` (`send-verification-email`,
  `send-reset-password-email`) reuse the create permission because no `user resend` permission is
  seeded. That is deliberate; do not add a permission for it without extending the seed.

## OpenAPI tagging

Tags mirror the module path with `/` as the separator: `Settings/Users`, `Settings/Roles`,
`Settings/Permissions`, `Settings/Select Options`; top-level modules get a single word
(`Authentication`, `Profile`, `General`). Tags are set once per module in `new Elysia({ detail: { tags } })`
and inherited by every child route — do not repeat them per route.

A module whose routes do **not** use `AuthPlugin` must set `security: []` in its `detail` block, to
clear the global `bearerAuth` requirement that `DocsPlugin` declares. `home` and `auth` both do this.
See [openapi.md](./openapi.md).

## Registering a route

1. Define it in the module's `index.ts` (see [handlers.md](./handlers.md)).
2. Make sure the module is composed into its parent: nested → `src/modules/settings/index.ts`;
   top-level → `src/modules/index.ts` (`bootstraps.use(<Name>Module)`).
3. Add it to the map above, with its guard.
