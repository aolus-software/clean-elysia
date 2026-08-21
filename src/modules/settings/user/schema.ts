import { UserStatus } from "@database";
import { StrongPassword } from "@default";
import {
	userFilterableFields,
	userFilterExample,
	userSortableFields,
} from "@repositories";
import { datatableQueryParams } from "@types";
import { t } from "elysia";

export const UserStatusSchema = t.Enum(UserStatus);

export const UserListSchema = t.Object({
	id: t.String({ format: "uuid", description: "User unique identifier" }),
	name: t.String({ description: "User full name", examples: ["John Doe"] }),
	email: t.String({
		format: "email",
		description: "User email address",
		examples: ["john@example.com"],
	}),
	status: t.Enum(UserStatusSchema),
	remark: t.Nullable(
		t.String({ description: "Optional remarks", examples: ["VIP customer"] }),
	),
	roles: t.Array(t.String(), {
		description: "Assigned role names",
		examples: [["admin", "editor"]],
	}),
	created_at: t.Date({ description: "Account creation date" }),
	updated_at: t.Date({ description: "Last update date" }),
});

export const UserCreateSchema = t.Object({
	name: t.String({
		description: "User full name",
		examples: ["John Doe"],
	}),
	email: t.String({
		format: "email",
		description: "Valid email address",
		examples: ["john@example.com"],
	}),
	password: t.String({
		pattern: StrongPassword.source,
		description:
			"Strong password with uppercase, lowercase, number, and special character",
		examples: ["MySecure123!"],
	}),
	status: t.Enum(UserStatusSchema),
	remark: t.Nullable(
		t.String({ maxLength: 255, description: "Optional remarks" }),
	),
	role_ids: t.Array(t.String({ format: "uuid" }), {
		description: "Array of role UUIDs to assign",
	}),
});

export const UserDetailSchema = t.Object({
	id: t.String({ description: "User unique identifier" }),
	name: t.String({ description: "User full name" }),
	email: t.String({ description: "User email address" }),
	status: t.Enum(UserStatus),
	remark: t.Nullable(t.String({ description: "Optional remarks" })),
	created_at: t.Date({ description: "Account creation date" }),
	updated_at: t.Date({ description: "Last update date" }),
	roles: t.Array(
		t.Object({
			id: t.String({ description: "Role ID" }),
			name: t.String({ description: "Role name" }),
		}),
		{ description: "Assigned roles with details" },
	),
});

export const UserUpdateSchema = t.Object({
	name: t.String({
		description: "User full name",
		examples: ["John Doe"],
	}),
	email: t.String({
		format: "email",
		description: "Valid email address",
		examples: ["john@example.com"],
	}),
	status: t.Enum(UserStatusSchema),
	remark: t.Nullable(
		t.String({ maxLength: 255, description: "Optional remarks" }),
	),
	role_ids: t.Array(t.String({ format: "uuid" }), {
		description: "Array of role UUIDs to assign",
	}),
});

export const UserResetPasswordSchema = t.Object({
	newPassword: t.String({
		pattern: StrongPassword.source,
		description:
			"New strong password with uppercase, lowercase, number, and special character",
		examples: ["NewSecure123!"],
	}),
});

// === QUERY ===

/* Documented against the repository's own allow-lists, so /docs shows exactly
   the sort values and filter keys UserRepository().findAll validates against. */
export const UserQuerySchema = datatableQueryParams({
	sortFields: userSortableFields,
	filterFields: userFilterableFields,
	filterExample: userFilterExample,
});
