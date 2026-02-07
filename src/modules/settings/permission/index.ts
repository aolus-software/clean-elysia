import { PermissionGuard } from "@guards";
import { AuthPlugin } from "@plugins";
import { DatatableQueryParams } from "@types";
import {
	CommonResponseSchemas,
	DatatableToolkit,
	PaginatedResponseSchema,
	ResponseToolkit,
	SuccessResponseSchema,
} from "@utils";
import Elysia, { t } from "elysia";

import {
	PermissionCreateSchema,
	PermissionListSchema,
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
		async ({ query }) => {
			const queryParam = DatatableToolkit.parseFilter(query);
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
			query: DatatableQueryParams,
			detail: {
				summary: "List all permissions",
				description:
					"Retrieve a paginated list of permissions with optional filtering. Requires 'permission list' permission.",
			},
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				500: CommonResponseSchemas[500],
				200: PaginatedResponseSchema(PermissionListSchema),
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				500: CommonResponseSchemas[500],
				422: CommonResponseSchemas[422],
				201: CommonResponseSchemas[201],
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				404: CommonResponseSchemas[404],
				422: CommonResponseSchemas[422],
				500: CommonResponseSchemas[500],
				200: SuccessResponseSchema(PermissionListSchema),
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				404: CommonResponseSchemas[404],
				422: CommonResponseSchemas[422],
				500: CommonResponseSchemas[500],
				200: SuccessResponseSchema(t.Null()),
			},
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
			response: {
				400: CommonResponseSchemas[400],
				401: CommonResponseSchemas[401],
				403: CommonResponseSchemas[403],
				404: CommonResponseSchemas[404],
				422: CommonResponseSchemas[422],
				500: CommonResponseSchemas[500],
				200: SuccessResponseSchema(t.Null()),
			},
		},
	);
