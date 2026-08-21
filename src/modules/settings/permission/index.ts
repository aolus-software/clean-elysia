import { PermissionGuard } from "@guards";
import { AuthPlugin } from "@plugins";
import {
	commonPaginatedResponse,
	commonResponse,
	DatatableToolkit,
	ResponseToolkit,
} from "@utils";
import Elysia, { t } from "elysia";

import {
	PermissionCreateSchema,
	PermissionListSchema,
	PermissionQuerySchema,
	PermissionUpdateSchema,
} from "./schema";
import { PermissionService } from "./service";

export const PermissionModule = new Elysia({
	prefix: "/permissions",
	detail: {
		tags: ["Settings/Permissions"],
		description: "APIs for managing permissions",
	},
})
	.use(AuthPlugin)
	.get(
		"",
		async ({ query, request }) => {
			const queryParam = DatatableToolkit.parseFilter(query, request.url);
			const result = await PermissionService.findAll(queryParam);

			return ResponseToolkit.success(
				result,
				"Permission list retrieved successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["permission list"]);
			},
			query: PermissionQuerySchema,
			detail: {
				summary: "List all permissions",
				description:
					"Retrieve a paginated list of permissions. Requires 'permission list' " +
					"permission. `search` matches the permission name and group. Sortable " +
					"and filterable fields are listed on the individual query parameters; " +
					"an unsupported `sort` is rejected with 422 and an unsupported " +
					"`filter[<key>]` with 400.",
			},
			response: commonPaginatedResponse(PermissionListSchema, {
				include: [200, 400, 401, 403, 422, 500],
			}),
		},
	)
	// Create permission
	.post(
		"",
		async ({ body }) => {
			await PermissionService.create(body);

			return ResponseToolkit.success(
				null,
				"Permission created successfully",
				201,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["permission create"]);
			},
			body: PermissionCreateSchema,
			detail: {
				summary: "Create new permission(s)",
				description:
					"Create one or more permissions in a specific group. Requires 'permission create' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [201, 400, 401, 403, 422, 500],
			}),
		},
	)
	// Get permission detail
	.get(
		"/:id",
		async ({ params }) => {
			const result = await PermissionService.detail(params.id);
			return ResponseToolkit.success(
				result,
				"Permission detail retrieved successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["permission detail"]);
			},
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
			detail: {
				summary: "Get permission detail",
				description:
					"Retrieve detailed information about a specific permission. Requires 'permission detail' permission.",
			},
			response: commonResponse(PermissionListSchema, {
				include: [200, 400, 401, 403, 404, 422, 500],
			}),
		},
	)
	// Update permission
	.patch(
		"/:id",
		async ({ params, body }) => {
			await PermissionService.update(params.id, body);
			return ResponseToolkit.success(
				null,
				"Permission updated successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["permission edit"]);
			},
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
			body: PermissionUpdateSchema,
			detail: {
				summary: "Update permission",
				description:
					"Update an existing permission's details. Requires 'permission edit' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [200, 400, 401, 403, 404, 422, 500],
			}),
		},
	)
	// Delete permission
	.delete(
		"/:id",
		async ({ params }) => {
			await PermissionService.delete(params.id);
			return ResponseToolkit.success(
				null,
				"Permission deleted successfully",
				200,
			);
		},
		{
			beforeHandle: ({ user }) => {
				PermissionGuard.canActivate(user, ["permission delete"]);
			},
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
			detail: {
				summary: "Delete permission",
				description:
					"Permanently delete a permission. Requires 'permission delete' permission.",
			},
			response: commonResponse(t.Null(), {
				include: [200, 400, 401, 403, 404, 422, 500],
			}),
		},
	);
