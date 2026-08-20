# Audit Findings Writing Rules

How to **write** a finding in `docs/audit-findings.md` or any other report produced by
`/audit-flow`. This rule governs the *writing*, not the *sweeping* — which categories are swept and
how much of the tree is covered live in `.claude/commands/audit-flow.md`.

## Principle: write for the person who has to decide, not for the auditor who found it

A finding is read by someone who was **not** in the audit: the owner deciding whether to spend a day
on it, a developer picking it up three weeks later, a reviewer asking "is this real?". They do not
have the audit's context loaded. They must be able to read one finding **in isolation** and come away
knowing **what the thing is, how it goes wrong, what it costs, and what to do about it** — without
opening the code first.

A finding written as a note-to-self fails this. This shape is what to avoid:

> ❌ "`password-reset-token.ts` has no `expired_at` column."

That is true, cited, and useless to anyone who does not already know what that table backs, who reads
it, or what breaks for a user. **Rewrite until a competent developer who has never opened that file
understands the problem.**

A `file:line` list is raw material, not a finished finding. A subagent's terse notes always get
expanded before they land in the document.

## Every finding has five blocks, in this order

Use these exact bolded inline labels — not `###` sub-headings — so findings scan uniformly:

```markdown
### §1.1 Password-reset links never expire — 🔴 bug — CONFIRMED

**Where:** `src/libs/database/postgres/schema/password-reset-token.ts`,
`src/modules/auth/service.ts` (`resetPassword`), `src/libs/repositories/forgot-password.repository.ts`

**What this is.** "Forgot password" writes a row to `password_reset_tokens` holding a random token and
emails the user a link containing it. `resetPassword` looks the token up, and if a row comes back it
hashes the new password and deletes the row inside a transaction. Single use is enforced by that
delete.

**Why this can happen.** The table has no `expired_at` column, so there is nothing to compare against
and `resetPassword` performs no time check. The sibling flow in the same file, `verifyEmail`, *does*
check `record.expired_at < new Date()` against `email_verifications` — so this is an omission specific
to password reset, not a house style.

**What it costs.** A reset link stays valid forever until it is used. A link sitting in an old inbox,
a mail archive, a browser history, or a forwarded thread is a permanent account-takeover credential.
Rotating the user's password does not invalidate outstanding links.

**What we should do.** Add `expired_at: timestamp().notNull()` to the schema, generate a migration,
set it from `resetPasswordLifetime` when the row is created, and reject expired rows in
`resetPassword` the way `verifyEmail` already does. Roughly half a day including the migration.
Consider `used_at` as well so consumption is auditable rather than inferred from a deleted row.
```

### Block-by-block requirements

| Block | Must contain | Must not contain |
|---|---|---|
| **Where** | Every relevant `file:line`. A finding with no location is not a finding. | Vague "in the auth module". |
| **What this is** | The mechanism in plain language — what the feature does, who calls it, what the normal path looks like. Assume the reader has never seen this subsystem. | Jargon used before it is explained; a line-by-line restatement of the code. |
| **Why this can happen** | The concrete trigger: who does what, in which order, under what conditions (an expired token, an unauthenticated caller, an empty field, a soft-deleted row). | "Could potentially", "may cause issues". If you cannot name the trigger, it is a SUSPECT — say so. |
| **What it costs** | The observable damage — what a *user* or *operator* sees. Data exposed to whom, a request that 500s, mail never delivered. | Severity restated as a feeling ("this is bad"). |
| **What we should do** | A specific, implementable fix; rough effort; the rule it should follow; other sites with the same shape. | An actual code change — audits are read-only (below). |

Short findings may compress **What it costs** into **Why this can happen**, but never drop **What
this is** or **What we should do** — those two are what make the report usable by anyone other than
the author.

## Plain language rules

- **Expand every abbreviation and pattern name on first use.** "soft delete (the row stays,
  `deleted_at` is stamped, and every read filters it out with `isNull(...)`)", then the short form
  after. Same for RBAC, N+1, TOCTOU, TTL. The reader may be an owner, not a backend engineer.
- **Prefer the domain word over the code word.** "any logged-in user can list every account" beats
  "`findAll` has no `PermissionGuard.canActivate` call". Give the code word right after, in the same
  sentence, so it stays greppable.
- **Say who.** Access-control findings must name the caller and the direction: *which* identity gets
  to do *what* to *whose* data. "Missing guard" is not a finding; "any authenticated user can reset
  another user's password" is.
- **Tell it as a sequence when it is a race, a pipeline, or a flow.** The register → verify-email and
  forgot-password → reset-password flows are sequences — write them as steps.
- **One finding, one problem.** Two independent defects in one paragraph become two numbered findings
  so each can be fixed, argued, or dismissed on its own.
- **No unexplained numbers.** `paginationLength` means nothing alone — say what it controls and why
  it is wrong here. Same for a TTL: name its unit.

## Severity — pick the tag from consequence, not from effort

| Tag | Meaning | Test |
|---|---|---|
| 🔴 **bug** | Wrong behaviour reachable today: data exposed to someone who should not see it, wrong data written, a request that fails, a secret in a log. | "Could I write a failing test for this against `main`?" |
| 🟠 **inconsistency / latent risk** | Correct today, but fragile — depends on a condition that could change, or diverges from a rule so the next change lands wrong. | "Does this break the moment someone adds the obvious next feature?" |
| 🟡 **hygiene** | Duplication, dead code, magic values, a misspelled filename or option key. No behavioural consequence. | "Is the only cost developer time?" |
| 📄 **doc** | A doc, rule, or `CLAUDE.md` claim contradicts the code. | See `documentation.md`. |

Security findings — a missing guard, an ungated route, a password hash or token reaching a log,
response, or OpenAPI example — are always 🔴 and always sort to the top of "Top priorities", ahead of
data integrity, then correctness, then hygiene/doc.

## Evidence: CONFIRMED vs SUSPECT

Every finding carries one, and the difference is honest:

- **CONFIRMED** — the path was traced end to end in the code and the trigger can be named. All five
  blocks are fillable.
- **SUSPECT** — the shape looks wrong but something is unverified (a guard might run in a
  `beforeHandle` further up the chain, a caller was not found, a plugin might already handle it). Say
  **what specifically is unverified** and **what would settle it**: "unverified: whether `AuthPlugin`
  rejects a token for a soft-deleted user; reading `src/libs/plugins/auth.plugin.ts` settles it."

Never promote a SUSPECT to CONFIRMED to make the report look stronger, and never bury one inside a
CONFIRMED list. A SUSPECT later disproved is marked **refuted**, not deleted.

## Document layout

1. **Header block** — sweep date, what was swept (paths and categories), which files were treated as
   ground truth, the severity legend, and an explicit read-only statement.
2. **Coverage** — what the sweep actually reached and what it deliberately did not, per
   `.claude/commands/audit-flow.md`. A reader must be able to tell "clean" from "not looked at".
3. **Top priorities** — a numbered list ordered security → data integrity → correctness →
   hygiene/doc, each one line pointing at its section. Write it last, in the plainest language in the
   document.
4. **Sections** — one per audit category, numbered stably (`§1`–`§N`). A scoped sweep uses its own
   prefix (e.g. `B1`–`BN`) so numbers never collide across reports.
5. **Verified-correct notes** — where a category came back clean, say so and name what was checked.
   "Clean" with no evidence is indistinguishable from "not audited".

Finding numbers are permanent identifiers — commits, branches, and follow-up conversations cite them.
**Never renumber** an existing finding; new ones append.

## Resolved findings stay, marked

When a finding is fixed, do **not** delete it in the same change that fixes it:

- Append `— ✅ RESOLVED <YYYY-MM-DD>` to its heading.
- Add a short quote block at the top saying what changed and in which branch, and **keep the original
  text below it**. The next auditor needs to see the pattern that was wrong, not just that it went
  away.
- Add a one-line entry to the header block's resolved note so the summary stays readable.
- Say plainly when a fix is *partial* or when a related finding survives it.

Pruning long-resolved items into a single "prior sweeps (see git history)" line is fine on a later
sweep, once the document gets unwieldy.

## Audits do not fix things

`/audit-flow` and every audit report are **read-only**. Findings are reported and the user decides
what gets fixed — that is `contradiction-halt.md`, and it applies with no exceptions here. "What we
should do" *describes* a fix; it does not perform one. The one file an audit writes is its findings
document.
