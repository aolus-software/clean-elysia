# Rule: Dependency injection (DI container)

The project ships a tiny DI container at `src/libs/plugins/core/container.ts` and exposes it two ways:

- as the exported singleton `container` (re-exported from `@plugins`)
- on the Elysia context via `DiPlugin` (which is already in `baseApp`), as `ctx.container`

## When to use it

Default to **direct imports** for services and repositories. The current codebase imports `AuthService`, `UserService`, etc. directly from `./service` — that's the norm and it works for nearly every case.

Use `container.resolve<T>(name)` when one of these is true:

1. The service is referenced from a place that would create a **circular import** if it imported the concrete module (e.g. a plugin that lives "above" the services).
2. You need to **swap implementations** at runtime (tests, feature flags, environment-specific backends).
3. The consumer doesn't know which concrete service it should call until request time.

If none of those apply, just `import { FooService } from "./service"` — adding indirection costs more than it earns.

## Registration

All registrations live in **one** place: `src/bootstrap.ts`. That function is called once from `src/app.ts` **before** the Elysia app is built. Any new service that needs to be DI-resolvable must be added there:

```ts
import { container } from "@plugins";
import { FooService } from "./modules/foo/service";

export const bootstrap = () => {
	container.register("authService", () => AuthService);
	container.register("fooService", () => FooService); // <-- new
};
```

Rules for registration keys:

- Use camelCase matching the service variable: `authService`, `userService`, `profileService`.
- Names must be unique across the whole container — collisions silently overwrite.
- The factory is `() => Service` (a thunk). Resolution memoizes the first return value via `instances` in the container, so subsequent `resolve("fooService")` calls hand back the same instance — keep factories pure.

## Resolution

Inside route handlers (`DiPlugin` is in `baseApp`):

```ts
.get("/foo", ({ container }) => {
  const fooService = container.resolve<typeof FooService>("fooService");
  return fooService.doThing();
})
```

Outside Elysia context:

```ts
import { container } from "@plugins";

const fooService = container.resolve<typeof FooService>("fooService");
```

The generic on `resolve<T>` is required — the container stores factories as `() => unknown`, so without it you get `unknown` back. The convention is `typeof <ServiceConst>` since services are plain objects.

## Don't

- Don't register from inside a service file or a module's `index.ts` — registration belongs only in `src/bootstrap.ts`. Spreading registration around makes startup order load-bearing in non-obvious ways.
- Don't call `container.resolve(...)` at module top level. The container is empty until `bootstrap()` runs, and top-level resolution can fire before that. Resolve inside the handler/method body.
- Don't `container.reset()` or `clearAll()` from application code. Those are escape hatches intended for tests.
- Don't use the container to inject repositories or utility functions. The container is for **services only** — the things that own business logic and might genuinely need swapping. Repositories are imported directly.
- Don't introduce a second DI library (tsyringe, inversify, awilix). The 30-line container in `core/container.ts` is intentional — extending it is cheaper than swapping it.
