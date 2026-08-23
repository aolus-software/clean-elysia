import {
	roleFilterableFields,
	roleFilterExample,
	roleSortableFields,
} from "@repositories";
import { datatableQueryParams } from "@types";
import { t } from "elysia";

export const RoleListSchema = t.Object({
	id: t.String({ format: "uuid", description: "Role unique identifier" }),
	name: t.String({ description: "Role name", examples: ["admin"] }),
	created_at: t.Date({ description: "Creation date" }),
	updated_at: t.Date({ description: "Last update date" }),
});

export const CreateRoleSchema = t.Object({
	name: t.String({
		description: "Role name",
		examples: ["editor"],
	}),
	permissionIds: t.Array(t.String({ format: "uuid" }), {
		description: "Array of permission UUIDs to assign",
	}),
});

export const UpdateRoleSchema = t.Object({
	name: t.String({
		description: "Role name",
		examples: ["editor"],
	}),
	permissionIds: t.Array(t.String({ format: "uuid" }), {
		description: "Array of permission UUIDs to assign",
	}),
});

// === QUERY ===

/* Documented against the repository's own allow-lists, so /docs shows exactly
   the sort values and filter keys RoleRepository().findAll validates against. */
export const RoleQuerySchema = datatableQueryParams({
	sortFields: roleSortableFields,
	filterFields: roleFilterableFields,
	filterExample: roleFilterExample,
});
