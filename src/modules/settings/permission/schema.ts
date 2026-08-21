import {
	permissionFilterableFields,
	permissionFilterExample,
	permissionSortableFields,
} from "@repositories";
import { datatableQueryParams } from "@types";
import { t } from "elysia";

export const PermissionCreateSchema = t.Object({
	name: t.Array(
		t.String({
			minLength: 1,
			maxLength: 255,
			description: "Permission name",
			examples: ["user.create"],
		}),
		{ description: "Array of permission names to create" },
	),
	group: t.String({
		minLength: 1,
		maxLength: 100,
		description: "Permission group name",
		examples: ["user"],
	}),
});

export const PermissionUpdateSchema = t.Object({
	name: t.String({
		minLength: 1,
		maxLength: 255,
		description: "Permission name",
		examples: ["user.create"],
	}),
	group: t.String({
		minLength: 1,
		maxLength: 100,
		description: "Permission group name",
		examples: ["user"],
	}),
});

export const PermissionListSchema = t.Object({
	id: t.String({
		format: "uuid",
		description: "Permission unique identifier",
	}),
	name: t.String({ description: "Permission name", examples: ["user.create"] }),
	group: t.String({ description: "Permission group", examples: ["user"] }),
	created_at: t.Date({ description: "Creation date" }),
	updated_at: t.Date({ description: "Last update date" }),
});

// === QUERY ===

/* Documented against the repository's own allow-lists, so /docs shows exactly
   the sort values and filter keys PermissionRepository().findAll validates
   against. */
export const PermissionQuerySchema = datatableQueryParams({
	sortFields: permissionSortableFields,
	filterFields: permissionFilterableFields,
	filterExample: permissionFilterExample,
});
