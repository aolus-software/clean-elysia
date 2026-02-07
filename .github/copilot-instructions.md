# GitHub Copilot Instructions for Clean Elysia Project

## Project Overview

This is a Clean Architecture Elysia.js project using Bun runtime with the following tech stack:

- Elysia.js with Bun runtime
- BullMQ for job queues
- Redis for caching and queue backend
- Drizzle ORM for database operations
- PostgreSQL as primary database
- TypeScript for type safety

## Code Style and Conventions

### Comment Style

Comments should be minimal and placed only where necessary to explain complex logic or business rules. Do not add comments every 2-4 lines. Use block comments for entire functions or logical sections.

Good example:

```typescript
/**
 * Validates user credentials and returns authentication token
 * Checks email verification status and account status before allowing login
 */
export const singIn = async (
	email: string,
	password: string,
): Promise<UserInformation> => {
	const user = await UserRepository().findByEmail(email);

	if (!user) {
		throw new BadRequestError("Validation error", [
			{
				field: "email",
				message: "Invalid email or password",
			},
		]);
	}

	const isPasswordValid = await Hash.compareHash(password, user.password);
	return await UserRepository().UserInformation(user.id);
};
```

Bad example:

```typescript
// Find user by email
const user = await UserRepository().findByEmail(email);

// Check if user exists
if (!user) {
	// Throw error
	throw new BadRequestError("Validation error", [
		{
			field: "email",
			message: "Invalid email or password",
		},
	]);
}

// Validate password
const isPasswordValid = await Hash.compareHash(password, user.password);

// Return user information
return await UserRepository().UserInformation(user.id);
```

### Import Organization

Use absolute imports with granular path aliases configured in tsconfig.json. Each directory in `src/libs` has its own dedicated alias:

```typescript
import { BadRequestError, UnauthorizedError } from "@errors";
import { db, users, userRoles } from "@database";
import { UserRepository } from "@repositories";
import { Hash, log } from "@utils";
import { UserInformation, DatatableType } from "@types";
import { StrongPassword } from "@default";
import { AuthPlugin } from "@plugins";
import { eq, and, or } from "drizzle-orm";
```

**Available Path Aliases:**

- `@base` - Base Elysia app configuration
- `@bull` - Queue and worker files
- `@cache` - Cache utilities and constants
- `@config` - Configuration files (AppConfig, DatabaseConfig, etc.)
- `@database` - Database related (db instance, schemas, tables, RedisClient)
- `@default` - Default constants (StrongPassword, paginationLength, etc.)
- `@errors` - Custom error classes
- `@guards` - Authorization guards (RoleGuard, PermissionGuard)
- `@mailer` - Email services and templates
- `@plugins` - Elysia plugins (AuthPlugin, SecurityPlugin, etc.)
- `@repositories` - Repository pattern implementations
- `@types` - TypeScript type definitions and interfaces
- `@utils` - Utility functions (Hash, log, ResponseToolkit, etc.)
- `@modules` - Application modules

**Import Grouping Order:**

1. External libraries (elysia, drizzle-orm, bullmq, etc.)
2. Granular aliases by category:
   - Configuration: `@config`
   - Database: `@database`
   - Errors: `@errors`
   - Types: `@types`
   - Repositories: `@repositories`
   - Utils: `@utils`
   - Others as needed
3. Relative imports (if absolutely necessary)
4. Type-only imports

**Examples:**

```typescript
// Module service example
import { BadRequestError } from "@errors";
import { db, emailVerifications, users } from "@database";
import { ForgotPasswordRepository, UserRepository } from "@repositories";
import { Hash, log } from "@utils";
import { UserInformation } from "@types";
import { AuthMailService } from "@mailer";
import { eq } from "drizzle-orm";

// Module index example
import { AuthPlugin } from "@plugins";
import { JWT_CONFIG } from "@config";
import { CommonResponseSchemas, ResponseToolkit } from "@utils";
import { UserInformation } from "@types";
import Elysia from "elysia";

// Repository example
import { BadRequestError, UnauthorizedError } from "@errors";
import { db, DbTransaction, userRoles, users } from "@database";
import { Hash } from "@utils";
import { defaultSort } from "@default";
import { DatatableType, PaginationResponse, UserInformation } from "@types";
```

### File Naming

- Use kebab-case for file names: `user.repository.ts`, `send-mail-queue.ts`
- Use `.service.ts` suffix for service files
- Use `.repository.ts` suffix for repository files
- Use `.plugin.ts` suffix for Elysia plugins
- Use `.config.ts` suffix for configuration files
- Use `schema.ts` for validation schemas

### Code Structure

#### Repository Pattern

Repositories should return factory functions that provide database access methods:

```typescript
export const UserRepository = () => {
	const dbInstance = db;

	return {
		db: dbInstance,
		getDb: (tx?: DbTransaction) => tx || dbInstance.$cache,

		findByEmail: async (email: string): Promise<User | null> => {
			const result = await dbInstance
				.select()
				.from(users)
				.where(eq(users.email, email))
				.limit(1);
			return result[0] || null;
		},
	};
};
```

#### Service Pattern

Services should export objects with methods, not classes:

```typescript
export const AuthService = {
	singIn: async (email: string, password: string): Promise<UserInformation> => {
		// Implementation
	},

	register: async (data: RegisterData): Promise<void> => {
		// Implementation
	},
};
```

#### Elysia Plugin Pattern

Create reusable Elysia plugins with proper naming:

```typescript
export const SecurityPlugin = new Elysia({
	name: "security-plugin",
})
	.use(helmet())
	.use(
		rateLimit({
			duration: 60000,
			max: 100,
		}),
	);
```

#### Error Handling

Use custom error classes that extend base Error:

```typescript
throw new BadRequestError("Validation error", [
	{
		field: "email",
		message: "Invalid email or password",
	},
]);

throw new UnauthorizedError("Unauthorized access");
throw new NotFoundError("Resource not found");
throw new ForbiddenError("Access forbidden");
```

Always catch and log errors with proper context:

```typescript
try {
	// Operation
} catch (error) {
	log.error({ error, userId }, "Operation failed");
	throw new BadRequestError("Operation failed");
}
```

### Drizzle ORM Patterns

Use Drizzle query builder with proper type safety:

```typescript
const users = await db
	.select()
	.from(users)
	.where(and(eq(users.status, "active"), isNull(users.deleted_at)))
	.orderBy(desc(users.created_at))
	.limit(limit)
	.offset(offset);
```

For complex queries with joins:

```typescript
const result = await db
	.select({
		id: users.id,
		name: users.name,
		role: roles.name,
	})
	.from(users)
	.leftJoin(userRoles, eq(users.id, userRoles.user_id))
	.leftJoin(roles, eq(userRoles.role_id, roles.id))
	.where(eq(users.id, userId));
```

Support transactions by accepting optional transaction parameter:

```typescript
findAll: async (
	queryParam: DatatableType,
	tx?: DbTransaction,
): Promise<PaginationResponse<UserList>> => {
	const database = tx || dbInstance;
	return await database.select().from(users);
};
```

### Redis Caching

Use RedisClient singleton pattern:

```typescript
const redis = RedisClient.getRedisClient();

// Set cache with expiration
await redis.set(cacheKey, JSON.stringify(data), "EX", 3600);

// Get cache
const cached = await redis.get(cacheKey);
if (cached) {
	return JSON.parse(cached);
}
```

### BullMQ Queue Pattern

Define queues with proper typing:

```typescript
export const SendMailQueue = new Queue<EmailOptions>("send-email", {
	connection: RedisClient.getQueueRedisClient(),
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: "exponential",
			delay: 2000,
		},
	},
});
```

Create workers with error handling:

```typescript
const worker = new Worker<EmailOptions>(
	"send-email",
	async (job) => {
		try {
			await EmailService.sendEmail(job.data);
			log.info({}, `Email job processed for ${job.data.to}`);
		} catch (error) {
			log.error(error, `Failed to process email job for ${job.data.to}`);
			throw error;
		}
	},
	{
		connection: queueRedis,
	},
);

worker.on("failed", (job, err) => {
	log.error(err, `Job ${job ? job.id : "unknown"} failed`);
});
```

### Validation Schemas

Use Elysia TypeBox for validation:

```typescript
export const LoginSchema = t.Object({
	email: t.String({
		format: "email",
	}),
	password: t.String({
		minLength: 1,
	}),
});

export const RegisterSchema = t.Object({
	email: t.String({
		format: "email",
	}),
	name: t.String({
		minLength: 1,
		maxLength: 255,
	}),
	password: t.String({
		pattern: StrongPassword.source,
		minLength: 8,
	}),
});
```

Apply schemas to routes:

```typescript
app.post(
	"/login",
	async ({ body }) => {
		return await AuthService.singIn(body.email, body.password);
	},
	{
		body: LoginSchema,
		response: LoginResponseSchema,
	},
);
```

### Module Structure

Each module should have:

- `index.ts` - Route definitions and module bootstrap
- `schema.ts` - Validation schemas
- `service.ts` - Business logic (optional, for complex modules)

Module index.ts pattern:

```typescript
import { baseApp } from "@base";
import { AuthService } from "./service";
import { LoginSchema, RegisterSchema } from "./schema";

export const AuthModule = new Elysia({ prefix: "/auth" })
	.use(baseApp)
	.post(
		"/login",
		async ({ body }) => {
			const result = await AuthService.singIn(body.email, body.password);
			return { success: true, data: result };
		},
		{
			body: LoginSchema,
		},
	)
	.post(
		"/register",
		async ({ body }) => {
			await AuthService.register(body);
			return { success: true, message: "Registration successful" };
		},
		{
			body: RegisterSchema,
		},
	);
```

### Response Format

Standardize API responses:

```typescript
// Success response
return {
	success: true,
	data: result,
	message: "Operation successful",
};

// Success with pagination
return {
	success: true,
	data: results,
	meta: {
		page: 1,
		perPage: 10,
		total: 100,
		totalPages: 10,
	},
};

// Error response (handled by error plugin)
{
	success: false,
	status: 400,
	message: "Validation error",
	errors: [
		{
			field: "email",
			message: "Invalid email format",
		},
	],
}
```

### Logging

Use structured logging with pino:

```typescript
import { log } from "@libs";

log.info({ userId, action }, "User action completed");
log.warn({ error: error.message }, "Warning occurred");
log.error({ error, context }, "Error occurred");
```

### TypeScript Types

Define types in `src/libs/types/` directory organized by domain:

```typescript
// types/repositories/user.ts
export interface UserCreate {
	name: string;
	email: string;
	password: string;
}

export interface UserInformation {
	id: string;
	name: string;
	email: string;
	status: string;
	roles: string[];
	permissions: string[];
}
```

Use TypeBox for runtime validation types when needed:

```typescript
export const UserInformationTypeBox = t.Object({
	id: t.String(),
	name: t.String(),
	email: t.String(),
	status: t.String(),
});
```

### Configuration

Store configuration in separate config files under `src/libs/config/`:

```typescript
export const AppConfig = {
	APP_PORT: process.env.APP_PORT || 3000,
	APP_ENV: process.env.APP_ENV || "development",
};

export const DatabaseConfig = {
	DB_HOST: process.env.DB_HOST || "localhost",
	DB_PORT: parseInt(process.env.DB_PORT || "5432"),
	DB_NAME: process.env.DB_NAME || "database",
	DB_USER: process.env.DB_USER || "user",
	DB_PASSWORD: process.env.DB_PASSWORD || "password",
};
```

### Security Best Practices

Use bcrypt for password hashing:

```typescript
const hashedPassword = await Hash.hashPassword(password);
const isValid = await Hash.compareHash(password, hashedPassword);
```

Use JWT for authentication:

```typescript
const token = await jwt.sign({
	userId: user.id,
	email: user.email,
});
```

Apply authentication guards:

```typescript
app.use(AuthPlugin).get("/protected", async ({ user }) => {
	return { data: user };
});
```

### Testing Patterns

Write clean test cases focusing on behavior:

```typescript
describe("AuthService", () => {
	it("should authenticate user with valid credentials", async () => {
		const result = await AuthService.singIn("user@example.com", "password");
		expect(result).toHaveProperty("id");
		expect(result).toHaveProperty("accessToken");
	});
});
```

### Performance Considerations

Use database indexes for frequently queried fields
Implement Redis caching for expensive queries
Use BullMQ for background jobs and async operations
Leverage Bun's performance benefits with minimal abstractions
Use connection pooling for database connections
Implement pagination for list endpoints

### Code Quality

No console.log in production code, use logger instead
Handle all errors explicitly, no silent failures
Validate all user inputs using TypeBox schemas
Use TypeScript strict mode
Follow clean architecture principles with clear separation of concerns
Keep functions focused and single-purpose
Prefer composition over inheritance
Use dependency injection where appropriate
