# Rule: Clean code

Formatting and most type discipline are machine-enforced. This rule covers what the machine checks, and the conventions it cannot check.

## The commands

| Task | Script | Make target |
| --- | --- | --- |
| Lint | `bun run lint` | `make lint` |
| Lint and fix | `bun run lint:fix` | `make lint-fix` |
| Format | `bun run format` | `make format` |
| Check formatting only | `bun run format:check` | *(none)* |
| Type check | `bun run typecheck` | `make typecheck` |

`typecheck` is `bun run tsc --noEmit` — bare `tsc` is not on `PATH`, so invoke it through Bun. There is no `make format-check`; use the script.

Let the tools fix things. Reaching for `// eslint-disable-next-line` to silence a rule is a last resort. The existing disables are all `no-console`, and all sit in code that runs before or outside the logger — the cluster bootstrap in `src/index.ts`, `src/server.ts`, `src/bull/index.ts`, and the standalone scripts under `src/libs/database/clickhouse/scripts/` and `src/libs/i18n/scripts/`. Application code (modules, services, repositories, plugins) has none, and should stay that way.

## Formatting (Prettier, `.prettierrc`)

Tabs for indentation, width 2. Double quotes. Semicolons. Trailing commas everywhere. Print width 80. LF line endings. Don't argue with it, don't hand-align, don't reformat a file you didn't otherwise touch.

Imports are sorted by `simple-import-sort` at **error** level — aliased packages first, then relative. Never hand-order them.

## Types

- `@typescript-eslint/no-explicit-any` is an **error**. Use `unknown` and narrow. `catch (err: unknown)` is the shape; do not cast your way out.
- `strict` is on, plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, and `noFallthroughCasesInSwitch` (`tsconfig.json`). An unused parameter needs a `_` prefix, not a disable.
- **Explicit return types on every exported function**, and explicit parameter types throughout. ESLint does *not* enforce this — `explicit-function-return-type` is not configured — so it is on you. An exported service method or repository method whose return type is inferred is a review comment.
- Declare nullable and union locals with the type written out: `const user: UserDetail | null = ...`.
- `no-unused-expressions` is an error and `no-shadow` is a warning; treat both as errors.

## Promises

`@typescript-eslint/no-floating-promises` is an **error**. Every promise is `await`ed, `return`ed, or explicitly `.catch(...)`ed. There is no fire-and-forget in this codebase — background work goes to BullMQ (`queue.md`), which is itself awaited when enqueued.

Prefer `async`/`await` over promise chains. Handle errors explicitly; a swallowed `catch` that logs nothing is a bug.

## Logging

`no-console` is configured as a **warning**, which understates it: treat `console.*` as forbidden. Use the structured pino logger `log` from `@utils`, **object first, message second**:

```ts
log.info({ userId: user.id, email: user.email }, "Verification email queued");
log.error({ error, userId }, "Failed to queue verification email");
```

The object is the queryable part — put the identifiers there and keep the message a fixed string rather than interpolating values into it. Never log a password, a token, or a token-bearing URL.

## Comments

One block comment above a function, class, or genuinely non-obvious block, explaining **what and why**. No line-by-line narration of statements that already read clearly. Delete commented-out code rather than shipping it.

## Don't

1. No emoji, icons, box-drawing, or decorative symbols — in code, comments, log messages, catalogs, templates, or generated files.
2. No `console.*`.
3. No `any`.
4. No unawaited promise.
5. No `process.env` access outside `@config` (see `elysia.md`).
6. No new README, CHANGELOG, or docs file unless it was asked for. Keeping an existing doc true is a different obligation — see `documentation.md`.
