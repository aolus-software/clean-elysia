import { relations, sql } from "drizzle-orm";
import {
	index,
	pgEnum,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { emailVerifications } from "./email-verification";
import { passwordResetTokens } from "./password-reset-token";
import { userRoles } from "./rbac";

// Define enum values
export const userStatusEnum = pgEnum("user_status", [
	"active",
	"inactive",
	"suspended",
	"blocked",
]);

// Export enum object for Typebox
export const UserStatus = {
	ACTIVE: "active",
	INACTIVE: "inactive",
	SUSPENDED: "suspended",
	BLOCKED: "blocked",
} as const;

// Export type
export type UserStatusEnum = (typeof UserStatus)[keyof typeof UserStatus];

export const users = pgTable(
	"users",
	{
		id: uuid().primaryKey().defaultRandom(),
		name: varchar({ length: 255 }).notNull(),
		email: varchar({ length: 255 }).notNull(),
		status: userStatusEnum().default("active").notNull(),
		remark: varchar({ length: 255 }),
		password: varchar({ length: 255 }).notNull(),
		email_verified_at: timestamp(),
		deleted_at: timestamp(),
		created_at: timestamp().defaultNow().notNull(),
		updated_at: timestamp()
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("users_email_deleted_at_status_index").on(
			table.email,
			table.deleted_at,
			table.status,
		),
		uniqueIndex("users_email_unique_live")
			.on(table.email)
			.where(sql`${table.deleted_at} IS NULL`),
		index("users_created_at_live_index")
			.on(table.created_at)
			.where(sql`${table.deleted_at} IS NULL`),
	],
);

export const usersRelations = relations(users, ({ many }) => ({
	email_verifications: many(emailVerifications),
	password_reset_tokens: many(passwordResetTokens),
	user_roles: many(userRoles),
}));
