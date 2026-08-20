# Contradiction Halt Rule

## Principle: the request can be wrong — surface it, don't silently "fix" it

The user (or a task, plan, or ticket) may ask for something that contradicts these rules, the
established architecture, or that would introduce a bug. **The user may be wrong, and that is
expected.** When you detect such a contradiction, **stop and tell the user, and do nothing else about
it** until they decide.

This applies whether the contradiction is with:

- a rule in `.claude/rules/*.md` or `CLAUDE.md`,
- the documented architecture or an existing pattern in the codebase — the
  `src/modules/<name>/index.ts` → `service.ts` → `src/libs/repositories/*.repository.ts` layering,
  the plain-object service export, the repository factory-function shape, barrel exports in every
  `src/libs/<bucket>/index.ts`,
- a latent bug the requested change would create or depend on, or
- a security / access-control invariant — `PermissionGuard.canActivate(user, [...])` /
  `RoleGuard.canActivate(user, [...])` running in `beforeHandle`, the soft-delete
  `isNull(<table>.deleted_at)` filter on every read, password hashing through `Hash` (`@utils`),
  token lifetimes from `@default`, sort/filter allow-listing in the repository's `validateOrderBy`
  map, and `security: []` on modules whose routes are genuinely public.

## What "do nothing" means

- **Do not implement the contradicting change**, not even a best-guess partial version.
- **Do not silently work around it** or quietly pick a different approach without saying so.
- **Do not fix the contradicting bug on your own initiative** as part of an unrelated task — report
  it and wait.

## What to do instead

1. State the contradiction plainly: what was requested, which rule / pattern / invariant it conflicts
   with (cite the rule file or `file:line`), and the concrete consequence — bug, data leak, broken
   contract, inconsistency.
2. If you have a compliant alternative, offer it as a recommendation — but still let the user choose.
3. Proceed once the user confirms. If they confirm the original request knowing the trade-off, that
   is their call to make, and you implement it in full.

## Scope

- This is a **halt-and-report** rule, not permission to refuse work. Once the user acknowledges the
  contradiction and decides, follow their decision.
- It does **not** apply to trivial style nits you can just conform to — match the surrounding code
  and move on. It applies to genuine contradictions with rules, architecture, security, or
  correctness.
- It does not license scope creep in the other direction either: noticing an unrelated defect means
  *reporting* it, not fixing it inside the current change.

## Known contradictions already on record

These are confirmed in this repository and awaiting a decision. Do not build on any of them without
raising it first:

- **Password-reset links never expire.**
  `src/libs/database/postgres/schema/password-reset-token.ts` declares `password_reset_tokens` with
  `id`, `user_id`, `token`, `created_at`, and `updated_at` — there is no `expired_at` column — and
  `AuthService.resetPassword` (`src/modules/auth/service.ts`) only looks the token up via
  `ForgotPasswordRepository().findByToken(token)` and rejects it when the row is missing. Nothing
  checks age, so a reset link stays valid until it is used. Adding an expiry is a schema change plus
  a migration plus a check in `resetPassword`; do not "just add the check" without raising it.

- **The `.agents/skills/` bundle is a generation behind its sibling repositories.**
  `.claude/skills` is a symlink to `.agents/skills`. Treat the bundle as vendored: do not edit it as
  part of unrelated work, and flag rather than "modernise" it.
- **There are no tests and no test runner.** `package.json` defines no test script and `CLAUDE.md`
  says so explicitly, so none of the invariants above has a regression test. Do not cite a test as
  evidence that something is safe, and do not invent `bun test` commands.
