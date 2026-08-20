# Rule: Imports and naming

Cross-layer imports go through a path alias. Ordering is machine-enforced. Filenames and symbols
follow a fixed shape per role.

## Path aliases

Defined in `tsconfig.json` `paths` and resolved by Bun directly — there is no extra resolver plugin.
The full list:

| Alias               | Maps to                  |
| ------------------- | ------------------------ |
| `@base`             | `src/base.ts`            |
| `@bull`             | `src/bull/`              |
| `@cache`            | `src/libs/cache/`        |
| `@config`           | `src/libs/config/`       |
| `@database`         | `src/libs/database/`     |
| `@default`          | `src/libs/default/`      |
| `@errors`           | `src/libs/errors/`       |
| `@guards`           | `src/libs/guards/`       |
| `@i18n`             | `src/libs/i18n/`         |
| `@mailer`           | `src/libs/mailer/`       |
| `@plugins`          | `src/libs/plugins/`      |
| `@repositories`     | `src/libs/repositories/` |
| `@types`            | `src/libs/types/`        |
| `@utils`            | `src/libs/utils/`        |
| `@modules`          | `src/modules/`           |

`tsconfig.json` also carries a `@prisma-generated` entry pointing at `prisma/generated/client`.
**That directory does not exist in this repo** — this project uses Drizzle. The alias is a leftover
from the Prisma sibling template. Don't import through it; don't add code that would make it real
without raising it first (see [contradiction-halt.md](./contradiction-halt.md)).

Rules:

- **Always use the alias for anything outside the current folder.** Never `../../libs/...`.
- **Import from the bucket root, not a deep path.** `import { log } from "@utils"`, not
  `"@utils/elysia/logger"`. Each `src/libs/<bucket>/index.ts` is a barrel — a new file that isn't
  re-exported there won't resolve. See [shared-code.md](./shared-code.md).
- **Relative imports are allowed only inside the same module folder**: `./schema`, `./service`.
  A relative import that climbs above the module root means the code belongs in `libs/`.

## Import order — don't hand-sort it

`eslint-plugin-simple-import-sort` owns ordering (`simple-import-sort/imports` and
`simple-import-sort/exports` are both `"error"` in `eslint.config.mjs`). Write imports in any order
and run `bun run lint:fix`. Reviewing a diff for import order is wasted effort; if the ordering is
wrong, lint is failing.

The resulting shape looks like this — `node:` builtins, then external packages and aliases
alphabetized together, then relatives:

```ts
import { AppConfig } from "@config";
import { bootstraps } from "@modules";
import { DocsPlugin, ErrorHandlerPlugin, LocalePlugin } from "@plugins";
import { Elysia } from "elysia";

import { bootstrap } from "./bootstrap";
```

## File naming

kebab-case throughout, with a role suffix where the role isn't implied by the folder:

| Kind                 | Pattern                                        | Example                        |
| -------------------- | ---------------------------------------------- | ------------------------------ |
| Repository           | `<entity>.repository.ts`                       | `user.repository.ts`           |
| Plugin               | `<concern>.plugin.ts`                          | `error-handler.plugin.ts`      |
| Config               | `<area>.config.ts`                             | `env.config.ts`                |
| Domain service in `libs/` | `<name>.service.ts`                       | `auth-mail.service.ts`         |
| Queue                | `<job>-queue.ts`                               | `send-email-queue.ts`          |
| Worker               | `<job>-worker.ts`                              | `send-email-worker.ts`         |
| Drizzle table        | `<entity>.ts` — **no** `.schema.ts` suffix     | `password-reset-token.ts`      |
| Module files         | `index.ts` / `schema.ts` / `service.ts`        | `src/modules/auth/schema.ts`   |

Module files carry no role suffix — the folder is the namespace, so it's `service.ts`, never
`auth.service.ts`, inside `src/modules/auth/`.

Drizzle tables live in `src/libs/database/postgres/schema/`, one file per aggregate rather than
strictly one per table: `user.ts`, `email-verification.ts`, `password-reset-token.ts`, and
`rbac.ts` — which holds `roles`, `permissions`, `rolePermissions`, and `userRoles` together.

## Symbol naming

- **Drizzle tables: plain lowercase-plural camelCase, no suffix** — `users`, `roles`, `permissions`,
  `rolePermissions`, `userRoles`, `emailVerifications`, `passwordResetTokens`. Not `usersTable`, not
  `UserTable`. Relations get the `Relations` suffix (`usersRelations`, `rolePermissionRelations`).
- **Drizzle enums**: the `pgEnum` is camelCase with an `Enum` suffix (`userStatusEnum`); the const
  object for TypeBox is PascalCase (`UserStatus`); the derived type is PascalCase with `Enum`
  (`UserStatusEnum`). All three ship together — see [validation.md](./validation.md).
- **Repositories**: `PascalCaseRepository` factory — `UserRepository`, `RoleRepository`,
  `ForgotPasswordRepository`.
- **Services**: `PascalCaseService` plain-object export — `AuthService`, `RoleService`.
- **Plugins**: `PascalCasePlugin` — `AuthPlugin`, `SecurityPlugin`. The Elysia `name` option is
  kebab-case and *not* suffixed (`name: "security"`) — see [plugins.md](./plugins.md).
- **Modules**: `PascalCaseModule` — `AuthModule`, `RoleModule`. The Elysia `name` is kebab-case.
- **Schemas**: PascalCase ending in `Schema` — `UserCreateSchema`, `UserListSchema`.
- **Guards**: `PascalCaseGuard` with a static `canActivate` — `PermissionGuard`, `RoleGuard`.
- **Cache keys**: `<Concept>CacheKey` builder function from `@cache` — `UserInformationCacheKey`.
- **DI keys**: camelCase matching the service const — `container.register("authService", …)`. See
  [di.md](./di.md).

## TypeScript and formatting

Formatting is Prettier's job (`bun run format`): tabs, double quotes, semicolons, trailing commas,
80-column print width, LF endings. Don't argue with it in review.

Type rules that are actual errors, not preferences:

- `strict` is on, plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, and
  `noFallthroughCasesInSwitch`. Prefix a deliberately-unused parameter with `_`
  (`argsIgnorePattern: "^_"`).
- `@typescript-eslint/no-explicit-any` is **error**. Use `unknown` and narrow.
- `@typescript-eslint/no-floating-promises` is **error**. `await` it or `void` it.
- `no-console` is a warning; use `log` from `@utils`. The only accepted `console.log` calls are the
  boot banners in `src/index.ts` and `src/server.ts`, which already carry
  `eslint-disable-next-line no-console`.
- Prefer explicit return types on exported functions, especially repository and service methods.
- Comments explain *why* when the why is non-obvious. No line-by-line narration.
