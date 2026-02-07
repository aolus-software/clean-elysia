import { UserStatus } from "@database";
import { StrongPassword } from "@default";
import { t } from "elysia";

export const UserStatusSchema = t.Enum(UserStatus);

export const UserListSchema = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	email: t.String({ format: "email" }),
	status: t.Enum(UserStatusSchema),
	remark: t.Nullable(t.String()),
	roles: t.Array(t.String()),
	created_at: t.Date(),
	updated_at: t.Date(),
});

export const UserCreateSchema = t.Object({
	name: t.String(),
	email: t.String({ format: "email" }),
	password: t.String({
		pattern: StrongPassword.source,
	}),
	status: t.Enum(UserStatusSchema),
	remark: t.Nullable(t.String({ maxLength: 255 })),
	role_ids: t.Array(t.String({ format: "uuid" })),
});

export const UserDetailSchema = t.Object({
	id: t.String(),
	name: t.String(),
	email: t.String(),
	status: t.Enum(UserStatus),
	remark: t.Nullable(t.String()),
	created_at: t.Date(),
	updated_at: t.Date(),
	roles: t.Array(
		t.Object({
			id: t.String(),
			name: t.String(),
		}),
	),
});

export const UserUpdateSchema = t.Object({
	name: t.String(),
	email: t.String({ format: "email" }),
	status: t.Enum(UserStatusSchema),
	remark: t.Nullable(t.String({ maxLength: 255 })),
	role_ids: t.Array(t.String({ format: "uuid" })),
});

export const UserResetPasswordSchema = t.Object({
	newPassword: t.String({
		pattern: StrongPassword.source,
	}),
});
