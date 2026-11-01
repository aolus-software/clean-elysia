# API Security Documentation

## Overview

This document describes the security mechanisms, authentication flows, and best practices implemented in the Clean Elysia API.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Password Security](#password-security)
3. [Token Management](#token-management)
4. [Rate Limiting](#rate-limiting)
5. [Input Validation](#input-validation)
6. [Security Headers](#security-headers)
7. [RBAC (Role-Based Access Control)](#rbac-role-based-access-control)
8. [Best Practices](#best-practices)

---

## Authentication & Authorization

### Authentication Flow

The API uses **JWT (JSON Web Tokens)** for authentication. The authentication flow works as follows:

#### 1. User Registration

```
POST /auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

- Password is hashed using bcrypt before storage
- Email verification link is sent to the user
- User account is created but marked as unverified
- An email already held by a live account is rejected with `422`

#### 2. Email Verification

```
POST /auth/verify-email
{
  "token": "verification_token_from_email"
}
```

- Verifies user's email address
- Activates the account for login

#### 3. Login

```
POST /auth/login
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

- The password is checked before account state. An unknown email and a wrong password get the same
  `400` invalid-credentials message, and an unknown email is still compared against a dummy bcrypt
  hash so timing does not reveal whether the address is registered
- Only after the password matches does login report an unverified email or an inactive account

**Response:**

```json
{
	"success": true,
	"message": "Login successful",
	"data": {
		"user": {
			"id": "uuid",
			"name": "John Doe",
			"email": "john@example.com",
			"role": "user"
		},
		"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
	}
}
```

#### 4. Authenticated Requests

Include the JWT token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Authorization Plugin

Protected routes require authentication via the `AuthPlugin`. It validates JWT tokens and loads user information into the request context.

**Usage:**

```typescript
import { AuthPlugin } from "@plugins";

// Apply to protected routes
app.use(AuthPlugin).get("/protected", ({ currentUser }) => {
	return { user: currentUser };
});
```

---

## Password Security

### Password Requirements

**For Login (Basic Validation):**

- Minimum 8 characters
- Maximum 128 characters

**For Registration/Password Changes (Strong Validation):**

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&\*()\_+-=[]{}|;:,.<>?)

### Password Storage

- Passwords are **never** stored in plain text
- Passwords are hashed using **bcrypt** with automatic salt generation
- Hash rounds are configured for optimal security/performance balance

### Password Reset Flow

#### 1. Request Reset

```
POST /auth/forgot-password
{
  "email": "user@example.com"
}
```

- Sends password reset link to email
- Token expires after a configured time period (default: 1 hour)
- For security, same response is returned whether email exists or not

#### 2. Reset Password

```
POST /auth/reset-password
{
  "token": "reset_token_from_email",
  "password": "NewSecure123!"
}
```

- Validates reset token
- Ensures new password meets strong password requirements
- Invalidates old tokens after successful reset

---

## Token Management

### JWT Token Structure

```json
{
	"sub": "user_uuid",
	"email": "user@example.com",
	"role": "user",
	"iat": 1640000000,
	"exp": 1640086400
}
```

### Token Lifecycle

1. **Access Token**: Short-lived token for API requests (default: 24 hours)

### Token Validation

All authenticated endpoints validate:

- Token signature
- Token expiration
- User existence
- User active status

### Token Revocation

Tokens can be invalidated through:

- Password change (invalidates all existing tokens)
- Admin action (account suspension)

---

## Rate Limiting

Rate limiting is implemented to prevent abuse and brute force attacks.

### Default Limits

| Endpoint Type | Limit        | Window     |
| ------------- | ------------ | ---------- |
| General API   | 100 requests | 60 seconds |

Each client gets its own bucket, keyed by the TCP peer address from the listening server's
`requestIP()`. Client headers such as `X-Forwarded-For` are never trusted for the key. Behind a
reverse proxy every request arrives from the proxy's address, so rate-limit at the proxy as well.

### Rate Limit Exceeded Response

```json
{
	"success": false,
	"message": "Too many requests. Please try again later.",
	"data": null
}
```

---

## Input Validation

All API inputs are validated using **TypeBox schemas** with automatic OpenAPI integration.

### Validation Levels

1. **Type Validation**: Ensures correct data types
2. **Format Validation**: Email format, UUID format, etc.
3. **Business Rules**: Password strength, min/max lengths

### Validation Error Response

```json
{
	"success": false,
	"message": "Validation Error",
	"data": null,
	"errors": {
		"email": ["Must be a valid email address"],
		"password": ["Password must be at least 8 characters"]
	}
}
```

### Common Validations

| Field Type        | Validation Rules                  |
| ----------------- | --------------------------------- |
| Email             | Valid email format, max 255 chars |
| Password (basic)  | Min 8 chars, max 128 chars        |
| Password (strong) | Min 8 chars + complexity rules    |
| UUID              | Valid UUID v4 format              |
| Name              | Min 1 char, max 255 chars         |

---

## Security Headers

The API uses **elysia-helmet** to set security headers on all responses:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

### CORS Configuration

CORS is configured via `@elysiajs/cors` and the `ALLOWED_HOST` environment variable:

**Development:**

- Allows all origins for testing (`*`)
- Credentials enabled

**Production:**

- Whitelist of allowed origins
- Credentials enabled for trusted domains only

---

## RBAC (Role-Based Access Control)

### Roles

The system implements hierarchical role-based access:

1. **Super Admin**: Full system access
2. **Admin**: Manage users and settings
3. **User**: Standard user access

### Permissions

Granular permissions control specific actions:

- `user list`: View users
- `user create`: Create users
- `user edit`: Update users
- `user delete`: Delete users
- `role list/create/edit/delete`: Manage roles
- `permission list/create/edit/delete`: Manage permissions

### Permission Guards

Routes can be protected with permission requirements:

```typescript
import { PermissionGuard } from "@guards";

app.use(PermissionGuard("user create")).post("/users", createUserHandler);
```

### Role Guards

Routes can be protected with role requirements:

```typescript
import { RoleGuard } from "@guards";

app.use(RoleGuard("superuser")).post("/admin/action", adminHandler);
```

---

## Best Practices

### For API Consumers

1. **Store tokens securely**
   - Use httpOnly cookies or secure storage
   - Never expose tokens in URLs
   - Clear tokens on logout

2. **Handle token expiration**
   - Implement token refresh logic
   - Gracefully handle 401 unauthorized responses
   - Redirect to login when tokens expire

3. **Use HTTPS**
   - Always use HTTPS in production
   - Never send credentials over HTTP

4. **Implement rate limit handling**
   - Respect rate limit headers
   - Implement exponential backoff on failures
   - Cache responses when appropriate

### For API Developers

1. **Never log sensitive data**
   - No passwords in logs
   - Mask sensitive fields
   - Use structured logging

2. **Keep dependencies updated**
   - Regular security updates
   - Monitor vulnerability databases

3. **Use environment variables**
   - Never hardcode secrets
   - Use different keys per environment
   - Rotate keys regularly

---

## Security Checklist

### Authentication

- [x] JWT-based authentication
- [x] Password hashing (bcrypt)
- [x] Email verification
- [x] Password reset with tokens
- [x] Token expiration
- [x] Secure password requirements

### Authorization

- [x] Role-based access control (RBAC)
- [x] Permission-based guards
- [x] Plugin-based authentication
- [x] Protected routes

### Input Validation

- [x] TypeBox schema validation
- [x] OpenAPI integration
- [x] Detailed error messages
- [x] Type safety

### Rate Limiting

- [x] Request rate limiting
- [x] Configurable limits

### Security Headers

- [x] CORS configuration
- [x] Helmet security headers
- [x] Content type validation

### Monitoring

- [x] Structured logging (Pino)
- [x] Request ID tracking
- [x] Error tracking

---

## Support & Contact

For security issues or vulnerabilities:

- **Do not** open public issues
- Use responsible disclosure practices
- Allow reasonable time for fixes

For general security questions:

- Review this documentation
- Check the API documentation

---

**Last Updated**: February 2026
**Version**: 1.0.0
