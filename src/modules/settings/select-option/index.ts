import { RoleGuard } from "@guards";
import { t as trans } from "@i18n";
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
				trans("selectOption.permissionsSuccess"),
				200,
			);
		},
		{
			detail: {
				summary: "Get permission select options",
				description: "Retrieve select options for permissions.",
			},
			beforeHandle: function ({ user }) {
				RoleGuard.canActivate(user, ["superuser"]);
			},
		},
	)
	.get(
		"/roles",
		async () => {
			const roles = await SelectOptionService.roleSelect();
			return ResponseToolkit.success(
				roles,
				trans("selectOption.rolesSuccess"),
				200,
			);
		},
		{
			detail: {
				summary: "Get role select options",
				description: "Retrieve select options for roles.",
			},
			beforeHandle: function ({ user }) {
				RoleGuard.canActivate(user, ["superuser"]);
			},
		},
	);
