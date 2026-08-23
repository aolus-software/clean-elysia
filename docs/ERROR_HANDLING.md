# Error Handling Documentation

## Overview

This application implements a comprehensive, centralized error handling system that provides:

- **Consistent Error Responses**: All errors follow the same structure
- **Type Safety**: TypeScript error classes with proper typing
- **Developer-Friendly**: Clear error messages for debugging
- **Plugin-Based**: Error handling registered as an Elysia plugin

## Error Response Format

All errors return a consistent JSON structure:

```json
{
	"success": false,
	"message": "Human-readable error message",
	"data": null,
	"errors": {}
}
```

### Response Fields

| Field     | Type      | Description                                          |
| --------- | --------- | ---------------------------------------------------- |
| `success` | `boolean` | Always `false` for errors                            |
| `message` | `string`  | Human-readable error description                     |
| `data`    | `null`    | Always null for error responses                      |
| `errors`  | `object`  | Detailed error information (e.g., validation errors) |

## Error Codes

### Authentication & Authorization (4xx)

| HTTP Status | Description                     |
| ----------- | ------------------------------- |
| 401         | User not authenticated          |
| 403         | User lacks required permissions |

### Resource Errors (4xx)

| HTTP Status | Description        |
| ----------- | ------------------ |
| 404         | Resource not found |

### Validation Errors (4xx)

| HTTP Status | Description             |
| ----------- | ----------------------- |
| 422         | Input validation failed |

### Request Errors (4xx)

| HTTP Status | Description                  |
| ----------- | ---------------------------- |
| 400         | Malformed or invalid request |
| 429         | Rate limit exceeded          |

### Server Errors (5xx)

| HTTP Status | Description             |
| ----------- | ----------------------- |
| 500         | Unexpected server error |

## Error Classes

Error classes are located in `src/libs/errors/`.

### Available Error Classes

#### BadRequestError (400)

Malformed or invalid request.

```typescript
import { BadRequestError } from "@errors";

throw new BadRequestError("Invalid request format");
```

#### UnauthorizedError (401)

User is not authenticated or has invalid credentials.

```typescript
import { UnauthorizedError } from "@errors";

throw new UnauthorizedError("Invalid token");
```

#### ForbiddenError (403)

User is authenticated but lacks required permissions.

```typescript
import { ForbiddenError } from "@errors";

throw new ForbiddenError("Insufficient permissions");
```

#### NotFoundError (404)

Requested resource does not exist.

```typescript
import { NotFoundError } from "@errors";

throw new NotFoundError("User not found");
```

#### UnprocessableEntityError (422)

Input is well-formed but fails a business rule. This is the status for a **uniqueness conflict** —
a duplicate role name, permission name, or email address — carrying a `[{ field, message }]` array so
the client can render the error inline. It is never 400 and never 409.

```typescript
import { UnprocessableEntityError } from "@errors";

throw new UnprocessableEntityError("Validation failed");
```

**Response**:

```json
{
	"success": false,
	"message": "Validation failed",
	"data": null,
	"errors": {
		"email": ["Invalid email format"],
		"age": ["Must be 18 or older"]
	}
}
```

#### TooManyRequestError (429)

Rate limit exceeded.

```typescript
import { TooManyRequestError } from "@errors";

throw new TooManyRequestError("Too many requests");
```

## Error Handler Plugin

The error handler is implemented as an Elysia plugin (`src/libs/plugins/error-handler.plugin.ts`) that catches all errors and formats them consistently.

### How It Works

The plugin uses Elysia's `onError` lifecycle hook:

```typescript
export const ErrorHandlerPlugin = new Elysia({ name: "error-handler" }).onError(
	({ code, error, set }) => {
		// Handle different error types
		// Return consistent error response
	},
);
```

### Error Processing Order

```
Error thrown
    ↓
Is it a custom error class? → Return with appropriate status code
    ↓
Is it a validation error? → Return 422 with field errors
    ↓
Is it a NOT_FOUND error? → Return 404
    ↓
Generic error → Return 500
```

## Using Error Classes

### Basic Usage

```typescript
import { UnauthorizedError, NotFoundError } from "@errors";

// In a service
const getUserById = async (id: string) => {
	const user = await db.query.users.findFirst({
		where: eq(users.id, id),
	});

	if (!user) {
		throw new NotFoundError(`User with ID ${id} not found`);
	}

	return user;
};
```

### In Route Handlers

```typescript
app.get("/users/:id", async ({ params }) => {
	const user = await UserService.findById(params.id);
	if (!user) {
		throw new NotFoundError("User not found");
	}
	return ResponseToolkit.success(user);
});
```

## Validation Errors

### TypeBox Validation

Elysia validates request bodies automatically using TypeBox schemas:

```typescript
app.post("/users", ({ body }) => createUser(body), {
	body: t.Object({
		email: t.String({ format: "email" }),
		password: t.String({ minLength: 8 }),
	}),
});
```

Invalid requests are automatically caught and returned as 422 errors.

## Best Practices

### 1. Use Specific Error Classes

✅ **Good**:

```typescript
if (!user) {
	throw new NotFoundError("User not found");
}

if (user.role !== "admin") {
	throw new ForbiddenError("Admin access required");
}
```

❌ **Bad**:

```typescript
if (!user) {
	throw new Error("Not found");
}
```

### 2. Provide Context in Error Messages

✅ **Good**:

```typescript
throw new NotFoundError(`User with ID ${userId} not found`);
```

❌ **Bad**:

```typescript
throw new NotFoundError("Not found");
```

### 3. Don't Expose Sensitive Information

✅ **Good**:

```typescript
throw new UnauthorizedError("Invalid credentials");
```

❌ **Bad**:

```typescript
throw new UnauthorizedError(`Password ${password} is incorrect`);
```

### 4. Log Before Throwing (for debugging)

```typescript
try {
	await externalService.call();
} catch (error) {
	logger.error({ error }, "External service failed");
	throw new BadRequestError("External service unavailable");
}
```

## Further Reading

- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [Elysia Error Handling](https://elysiajs.com/life-cycle/on-error.html)
- [Error Handling Best Practices](https://www.rfc-editor.org/rfc/rfc7807)
