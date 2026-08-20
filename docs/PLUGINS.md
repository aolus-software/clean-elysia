# Plugin System Documentation

## Overview

The Elysia plugin system provides a modular, extensible architecture for adding features to your application. Elysia has first-class plugin support built into the framework.

- **Modular Design**: Isolate features into reusable plugins
- **Lifecycle Hooks**: Control plugin initialization and behavior
- **Type Safety**: Full TypeScript support with type inference
- **Middleware Support**: Apply middleware at plugin level
- **Route Registration**: Define routes within plugins

## Architecture

### Plugin Location

All plugins are located in `src/libs/plugins/`:

```
src/libs/plugins/
├── index.ts                # Plugin exports
├── auth.plugin.ts          # JWT authentication
├── docs.plugin.ts          # OpenAPI/Scalar documentation
├── error-handler.plugin.ts # Centralized error handling
├── logger.plugin.ts        # Structured logging with pino
├── request-id.plugin.ts    # Request ID generation
└── security.plugin.ts      # CORS, rate limiting, helmet
```

## Available Plugins

### DocsPlugin

OpenAPI documentation with Scalar UI.

**File**: `docs.plugin.ts`

```typescript
export const DocsPlugin = new Elysia({ name: "docs" }).use(
	openapi({
		path: "/docs",
		provider: "scalar",
		documentation: {
			info: { title: "API", version: "1.0.0" },
			security: [{ bearerAuth: [] }],
		},
	}),
);
```

**Features**:

- Interactive Scalar UI at `/docs`
- OpenAPI spec at `/docs/openapi.json`
- Bearer JWT authentication configured
- Disabled in production by default

### ErrorHandlerPlugin

Centralized error handling for consistent API responses.

**File**: `error-handler.plugin.ts`

Catches all errors and maps them to appropriate HTTP status codes with consistent response format.

### AuthPlugin

JWT-based authentication with bearer token validation.

**File**: `auth.plugin.ts`

- Validates JWT tokens from Authorization header
- Loads and caches user information
- Provides `currentUser` in request context

### SecurityPlugin

Security-focused middleware bundle.

**File**: `security.plugin.ts`

- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: 100 requests per 60 seconds (default)
- **Helmet**: Security headers (CSP, HSTS, X-Frame-Options, etc.)

### LoggerPlugin

Structured logging using pino.

**File**: `logger.plugin.ts`

- Automatic request/response logging
- Configurable log levels
- Structured JSON output

### RequestPlugin

Request context enrichment.

**File**: `request-id.plugin.ts`

- Generates unique request IDs
- Adds `startedAt` timestamp to context

## Creating Plugins

### Basic Plugin

```typescript
import { Elysia } from "elysia";

export const MyPlugin = new Elysia({ name: "my-plugin" }).get(
	"/my-route",
	() => ({ message: "Hello from plugin!" }),
);
```

### Plugin with Middleware

```typescript
import { Elysia } from "elysia";

export const TimingPlugin = new Elysia({ name: "timing" })
	.onBeforeHandle(({ set }) => {
		set.headers["X-Start-Time"] = Date.now().toString();
	})
	.onAfterHandle(({ set }) => {
		const start = parseInt(set.headers["X-Start-Time"] || "0");
		set.headers["X-Response-Time"] = `${Date.now() - start}ms`;
	});
```

### Plugin with Configuration

```typescript
import { Elysia } from "elysia";

export const CachePlugin = (options: { ttl?: number } = {}) =>
	new Elysia({ name: "cache" }).derive(() => ({
		cache: {
			ttl: options.ttl || 3600,
		},
	}));
```

### Plugin with State

```typescript
import { Elysia } from "elysia";

export const CounterPlugin = new Elysia({ name: "counter" })
	.state("requestCount", 0)
	.onBeforeHandle(({ store }) => {
		store.requestCount++;
	})
	.get("/stats", ({ store }) => ({
		totalRequests: store.requestCount,
	}));
```

## Registering Plugins

### In the Application

Plugins are registered using `.use()`:

```typescript
// src/index.ts
const app = new Elysia()
	.use(DocsPlugin)
	.use(ErrorHandlerPlugin)
	.use(bootstraps)
	.listen(AppConfig.APP_PORT);
```

### In the Base App

Core plugins are registered in the base app:

```typescript
// src/base.ts
export const baseApp = new Elysia({ name: "base-app" })
	.use(RequestPlugin)
	.use(SecurityPlugin)
	.use(LoggerPlugin);
```

### Conditional Registration

```typescript
import { AppConfig } from "@config";

const app = new Elysia();

// DocsPlugin is always mounted; it serves nothing unless ENABLE_API_DOCS is on.
// Do not add an environment check here — the flag is the single switch.
app.use(DocsPlugin);
```

## Plugin Lifecycle Hooks

Elysia provides several lifecycle hooks for plugins:

| Hook             | Description                  |
| ---------------- | ---------------------------- |
| `onRequest`      | Runs on every request        |
| `onBeforeHandle` | Runs before route handler    |
| `onAfterHandle`  | Runs after route handler     |
| `onError`        | Runs when an error is thrown |
| `onResponse`     | Runs before sending response |
| `onStart`        | Runs when server starts      |
| `onStop`         | Runs when server stops       |

### Example with Hooks

```typescript
export const LifecyclePlugin = new Elysia({ name: "lifecycle" })
	.onStart(() => {
		console.log("Server started");
	})
	.onStop(() => {
		console.log("Server stopping");
	})
	.onRequest(({ request }) => {
		console.log(`${request.method} ${request.url}`);
	})
	.onError(({ error }) => {
		console.error("Error:", error.message);
	});
```

## Plugin Patterns

### Guard Plugin

Use guards for route-level authorization:

```typescript
import { Elysia } from "elysia";

export const AdminGuard = new Elysia({ name: "admin-guard" })
	.derive(({ headers }) => {
		// Validate admin access
		return { isAdmin: true };
	})
	.onBeforeHandle(({ isAdmin }) => {
		if (!isAdmin) {
			throw new ForbiddenError("Admin access required");
		}
	});
```

### Scoped Plugin

Plugins can be scoped to specific routes:

```typescript
const app = new Elysia().group("/admin", (app) =>
	app
		.use(AuthPlugin)
		.use(AdminGuard)
		.get("/dashboard", () => "Admin Dashboard"),
);
```

## Best Practices

### 1. Name Your Plugins

Always provide a unique name:

```typescript
// ✅ Good
new Elysia({ name: "auth" });

// ❌ Bad
new Elysia();
```

### 2. Keep Plugins Focused

Each plugin should have a single responsibility.

### 3. Export as Constants

```typescript
// ✅ Good
export const AuthPlugin = new Elysia({ name: "auth" });

// Or as factory for configurable plugins
export const CachePlugin = (opts: CacheOpts) => new Elysia({ name: "cache" });
```

### 4. Handle Errors Gracefully

Use custom error classes within plugins for consistent error responses.

### 5. Document Plugin Dependencies

If a plugin depends on another, document it clearly:

```typescript
/**
 * Requires: AuthPlugin (must be registered first)
 */
export const ProfilePlugin = new Elysia({ name: "profile" });
```

## Further Reading

- [Elysia Plugin Documentation](https://elysiajs.com/plugins/overview.html)
- [Elysia Lifecycle](https://elysiajs.com/essential/life-cycle.html)
- [Plugin Design Patterns](https://refactoring.guru/design-patterns/plugin)
