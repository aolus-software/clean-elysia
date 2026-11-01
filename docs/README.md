# Documentation Index

Welcome to the Clean Elysia API documentation. This directory contains comprehensive guides for working with the API.

## 📚 Available Documentation

### [API Documentation Guide](./API_DOCUMENTATION.md)

Complete guide for API consumers:

- Getting started with the API
- Understanding schemas and validation
- Request/response examples
- Error handling
- Authentication flows
- SDK generation

**Use this if you're:**

- Integrating with the API
- Building a client application
- Learning how to use the endpoints

### [Security Documentation](./SECURITY.md)

In-depth security documentation:

- Authentication & authorization flows
- Password security requirements
- Token management best practices
- Rate limiting
- RBAC implementation
- Security checklist

**Use this if you're:**

- Implementing authentication
- Understanding security mechanisms
- Conducting security audits
- Setting up production deployments

### [Error Handling Documentation](./ERROR_HANDLING.md)

Complete error handling reference:

- Error response format
- Error codes and their meanings
- Available error classes
- Creating custom errors
- Error logging and debugging
- Best practices

**Use this if you're:**

- Understanding error responses
- Handling errors in your client
- Creating custom error types
- Debugging application errors

### [Configuration Documentation](./CONFIGURATION.md)

Comprehensive configuration reference:

- All environment variables explained
- Type-safe configuration access
- Runtime validation
- Configuration best practices
- Production deployment checklist
- Troubleshooting config issues

**Use this if you're:**

- Setting up the application
- Configuring for different environments
- Understanding configuration options
- Deploying to production

### [Plugin System Documentation](./PLUGINS.md)

Complete plugin architecture guide:

- Creating custom plugins
- Plugin lifecycle
- Middleware and route registration
- Configuration options
- Example plugins
- Best practices

**Use this if you're:**

- Building modular features
- Creating reusable components
- Understanding the plugin architecture
- Extending application functionality

## 🚀 Quick Start

### 1. View Interactive Documentation

```
http://localhost:3000/docs
```

The interactive Scalar UI provides:

- Browse all endpoints
- Try requests directly
- View schemas and examples
- See validation rules in real-time

### 2. Download OpenAPI Spec

```
http://localhost:3000/docs/openapi.json
```

Use this to:

- Generate client SDKs
- Import into Postman/Insomnia
- Validate API contracts

### 3. Read the Guides

- Start with [API Documentation](./API_DOCUMENTATION.md) for general usage
- Check [Security Documentation](./SECURITY.md) for authentication details

## 📖 Documentation Features

### Enhanced Schemas

All schemas include:

- **Type information**: Clear data types
- **Validation rules**: Min/max lengths, formats, patterns
- **Error messages**: Descriptive validation errors
- **Examples**: Real-world usage examples
- **Descriptions**: Detailed field explanations

### Example Schema Documentation

```typescript
// Elysia uses TypeBox for schema definitions
const LoginSchema = t.Object({
	email: t.String({ format: "email", description: "Valid email address" }),
	password: t.String({ minLength: 8, description: "User password" }),
});
```

### Enhanced Routes

All routes include:

- **Tags**: Logical grouping for documentation
- **Validation**: TypeBox schemas for request/response
- **Security**: Auth requirements via guards
- **Examples**: Request/response samples

### Example Route Documentation

```typescript
app.post("/login", ({ body }) => AuthService.signIn(body), {
	body: LoginSchema,
	response: LoginResponseSchema,
	detail: {
		tags: ["Auth"],
		summary: "User login",
		description: "Authenticate user with email and password.",
	},
});
```

## 🔍 What's Documented

### ✅ Fully Documented Modules

- **Auth Module** (`/auth/*`)
  - User registration with email verification
  - Login with JWT tokens
  - Email verification flow
  - Password reset flow
  - Resend verification email

- **Profile Module** (`/profile/*`)
  - Get user profile
  - Update profile information
  - Change own password

- **Settings Module** (`/settings/*`)
  - User management (CRUD)
  - Role management (CRUD)
  - Permission management (CRUD)
  - Select options

- **Home Module** (`/`)
  - Root endpoint
  - Health check
  - Liveness check

## 🛠️ Development

### Updating Documentation

When adding new endpoints:

1. **Add TypeBox schema** with validation and descriptions
2. **Add route detail** with tags, summary, and description
3. **Update this documentation** if needed

### Viewing Changes

1. Start the development server:

   ```bash
   bun run dev
   ```

2. Visit the docs:

   ```
   http://localhost:3000/docs
   ```

3. Changes to schemas and routes appear automatically in the OpenAPI documentation

## 📞 Support

- **API Questions**: See [API Documentation](./API_DOCUMENTATION.md)
- **Security Questions**: See [Security Documentation](./SECURITY.md)
- **Issues**: GitHub Issues

## 📝 Related Files

- **Main README**: `../README.md`
- **TODO List**: `../TODO.md`
- **Source Code**: `../src/`
- **OpenAPI Output**: `http://localhost:3000/docs/openapi.json`

---

**Documentation Version**: 1.0.0
**Last Updated**: February 2026
**API Version**: v1
