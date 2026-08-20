# Rule: Commits

## Message format

Conventional Commits. The type prefixes in use in this repo's history are `feat`, `fix`, `chore`, `refactor`, `docs`, `remove`, and `test`. The summary is lowercase after the colon, imperative mood, under 72 characters, no trailing period.

```
feat: add rate limit override for auth endpoints
fix: resolve locale before enqueuing verification mail
chore: regenerate i18n translation keys
```

The full workflow — how to gather context, how to stage, how to write the body — lives in `.claude/commands/commit.md`. Read it there; it is not duplicated here, and it is the authority when the two ever drift.

## The pre-commit hook

There **is** a Husky hook at `.husky/pre-commit`, and it is heavier than a typical lint-staged hook. It runs, in order:

```
bun install
bun run format
bun run lint:fix
bunx drizzle-kit generate
bunx drizzle-kit migrate
bun run tsc --noEmit
bun run build
```

Three things follow from that.

**It is not lint-staged.** `package.json` does carry a `lint-staged` block (`"*.ts": ["bun run lint:fix", "bun run format"]`) and `lint-staged` is a devDependency, but nothing invokes it — the hook calls the scripts on the **whole tree**, not on staged files. Do not assume your unstaged files are safe from `format` and `lint:fix`.

**It touches the database and the migration folder.** `drizzle-kit generate` can write a new file into the migrations directory and `drizzle-kit migrate` runs against whatever `DATABASE_URL` points at. Check `git status` after the hook and stage or discard what it produced deliberately — an accidental empty migration is the classic mess here.

**It is slow.** `.claude/commands/commit.md` permits `--no-verify` on one condition: you have already run `format`, `lint`, and `build` in this session and they passed clean. That is the only case. Otherwise let the hook run, and if it fails, fix the cause, re-stage, and make a **new** commit — never `--amend` over a failed hook.

## Before you commit

If you are skipping the hook, you owe it these three manually — the hook's own checks, minus the destructive ones:

```
bun run format:check
bun run lint
bun run typecheck
```

## Never commit

1. `.env` or any `.env.*.local` — they are gitignored; do not `git add -f` them.
2. Secrets, keys, tokens, or a real `DATABASE_URL` / SMTP credential in a config default or a fixture.
3. `node_modules/`, `dist/`, or the compiled `server` binary.
4. Migration files the hook generated as a side effect of an unrelated change. A migration belongs to the schema change that needed it.
5. A hand-edited `src/libs/i18n/locales/keys.generated.ts`. Regenerate with `bun run i18n:keys` and commit the output — see `i18n.md`.
6. Formatting churn in files the change did not otherwise touch. If `bun run format` rewrote half the tree, that is its own `chore:` commit.

## Staging

Stage by explicit path. `git add -A` and `git add .` are forbidden by `.claude/commands/commit.md` for exactly the reasons above — the hook generates files, and blanket staging picks them up silently.
