import { relations } from "drizzle-orm";
import {
	index,
	pgTable,
	primaryKey,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { users } from "./user";

export const roles = pgTable("roles", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: varchar("name", { length: 100 }).notNull().unique(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const rolesRelations = relations(roles, ({ many }) => ({
	role_permissions: many(rolePermissions),
	user_roles: many(userRoles),
}));

export const permissions = pgTable("permissions", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: varchar("name", { length: 255 }).notNull().unique(),
	group: varchar("group", { length: 100 }).notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const permissionsRelations = relations(permissions, ({ many }) => ({
	role_permissions: many(rolePermissions),
}));

export const rolePermissions = pgTable(
	"role_permissions",
	{
		role_id: uuid("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
		permission_id: uuid("permission_id")
			.notNull()
			.references(() => permissions.id, { onDelete: "cascade" }),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.role_id, table.permission_id] }),
		permissionIdIndex: index("role_permissions_permission_id_index").on(
			table.permission_id,
		),
	}),
);

export const rolePermissionRelations = relations(
	rolePermissions,
	({ one }) => ({
		role: one(roles, {
			fields: [rolePermissions.role_id],
			references: [roles.id],
		}),
		permission: one(permissions, {
			fields: [rolePermissions.permission_id],
			references: [permissions.id],
		}),
	}),
);

export const userRoles = pgTable(
	"user_roles",
	{
		user_id: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role_id: uuid("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
		assigned_at: timestamp("assigned_at").defaultNow().notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.user_id, table.role_id] }),
		roleIdIndex: index("user_roles_role_id_index").on(table.role_id),
	}),
);

export const userRoleRelations = relations(userRoles, ({ one }) => ({
	user: one(users, {
		fields: [userRoles.user_id],
		references: [users.id],
	}),
	role: one(roles, {
		fields: [userRoles.role_id],
		references: [roles.id],
	}),
}));

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;

// Consider adding Insert types as well for better type safety
export type InsertRole = typeof roles.$inferInsert;
export type InsertPermission = typeof permissions.$inferInsert;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;
export type InsertUserRole = typeof userRoles.$inferInsert;
