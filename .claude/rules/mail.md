# Rule: Mail (`src/libs/mailer/`)

Two ways out of the process, and the default is the queue.

- **Enqueue** — `sendEmailQueue.add("send-email", { ... })` from `@bull`. The request returns immediately; `src/bull/worker/send-mail-worker.ts` picks the job up and calls `EmailService.sendEmail`. This is what every existing producer does.
- **Inline** — `EmailService.sendEmail(options)` (`src/libs/mailer/services/mail.service.ts`) opens the SMTP connection on the spot and blocks. Use it **only** when the mail must have landed before the response goes out, and say why in a comment.

Both paths converge on the same `EmailOptions` (`src/libs/types/libs/mailer.ts`), so a job payload and an inline call are the same object.

## `AuthMailService` — the pattern to copy

`src/libs/mailer/services/auth-mail.service.ts` owns the auth mails. Note that it is a **class**, unlike module services (which are plain object literals — see `modules.md`). Callers construct it:

```ts
sendEmailVerification: async (id: string) => {
	const user = await UserRepository().getDetail(id);
	const authMailService = new AuthMailService();
	await authMailService.sendVerificationEmail(user.id);
},
```

(`src/modules/settings/user/service.ts`.) Its two methods are `sendVerificationEmail(userId, tx?)` — the `tx` exists because it inserts the verification token, and that insert must join the caller's transaction — and `sendResetPasswordEmail(userId)`.

Each method does three things in order: mint and persist the token, enqueue the mail, log the outcome. A new mail flow belongs in a sibling `<area>-mail.service.ts`, not inline in a module service.

## Templates

Templates are plain HTML under `src/libs/mailer/templates/<area>/<name>.html` — `auth/email-verification.html`, `auth/forgot-password.html`. `template` in the options is the extensionless path relative to that directory.

**This is not Handlebars.** `sendEmail` reads the file and does a literal regex replace of `{{key}}` for each entry of `options.variables`, which is a flat `Record<string, string>`. No helpers, no conditionals, no loops, no nesting. If a template needs logic, the producer computes the string and passes it in.

Localisation is by filename: `resolveTemplatePath` looks for `<name>.<locale>.html` and falls back to `<name>.html`. It only looks when `options.lang` differs from `DEFAULT_LOCALE`, so `auth/email-verification.html` **is** the English template — there is no `.en.html`. When you add a template, add its `.id.html` in the same change (`auth/email-verification.id.html` and `auth/forgot-password.id.html` are the models), and keep the `{{...}}` placeholder set identical across the pair.

Producers set `lang: getCurrentLocale()` so the worker renders in the requester's locale rather than the worker's. Subjects come from the `mail.subject.*` catalog keys — see `i18n.md`.

## Config

- Front-end links are built from `AppConfig.CLIENT_URL` — `${AppConfig.CLIENT_URL}/auth/verify-email?token=${token}`. There is no `FRONTEND_URL` in this codebase.
- Transport is nodemailer, configured once in `src/libs/mailer/transport.ts` from `MailConfig`. `from` defaults inside `sendEmail`.
- Everything comes from `@config`. Never read `process.env` in mailer code.

## Don't

1. Don't call `EmailService.sendEmail` from a route handler or a module service by default — enqueue.
2. Don't prefix the subject yourself. `sendEmail` already prepends `[<APP_ENV>]` when `AppConfig.APP_ENV !== "production"`; doing it again ships `[STAGING] [STAGING] ...`.
3. Don't log a token, a verification URL, or a reset URL. The existing `log.info` calls carry `{ userId, email }` and nothing else — keep it that way.
4. Don't add a template without its `.id.html` sibling.
5. Don't pass a non-string into `variables`. The type is `Record<string, string>` and the replace is textual — format dates and numbers before you put them in.
6. Don't reach for `process.env.CLIENT_URL` or hardcode a host.
