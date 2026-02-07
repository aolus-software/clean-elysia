import { PermissionRepository, RoleRepository } from "@repositories";

export const SelectOptionService = {
	permissionSelect: async () => {
		return await PermissionRepository().selectOptions();
	},
	roleSelect: async () => {
		return await RoleRepository().selectOptions();
	},
};
