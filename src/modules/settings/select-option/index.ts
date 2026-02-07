import { AuthPlugin } from "@plugins";
import { ResponseToolkit } from "@utils";
import Elysia from "elysia";

import { SelectOptionService } from "./service";

export const SelectOptionModule = new Elysia({
	prefix: "/select-options",
	detail: {
		tags: ["Settings/Select Options"],
		description: "APIs for retrieving select options for settings",
	},
})
	.use(AuthPlugin)
	.get(
		"/permissions",
		async () => {
			const permissions = await SelectOptionService.permissionSelect();
			return ResponseToolkit.success(
				permissions,
				"Permission select options retrieved successfully",
				200,
			);
		},
		{
			detail: {
				summary: "Get permission select options",
				description: "Retrieve select options for permissions.",
			},
		},
	)
	.get(
		"/roles",
		async () => {
			const roles = await SelectOptionService.roleSelect();
			return ResponseToolkit.success(
				roles,
				"Role select options retrieved successfully",
				200,
			);
		},
		{
			detail: {
				summary: "Get role select options",
				description: "Retrieve select options for roles.",
			},
		},
	);
