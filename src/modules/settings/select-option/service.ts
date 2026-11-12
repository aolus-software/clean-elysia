import {
	Cache,
	PermissionSelectOptionsCacheKey,
	RoleSelectOptionsCacheKey,
	SELECT_OPTIONS_TTL_SECONDS,
} from "@cache";
import { PermissionRepository, RoleRepository } from "@repositories";
import { PermissionSelectOptions } from "@types";

export const SelectOptionService = {
	permissionSelect: async (): Promise<PermissionSelectOptions[]> => {
		const key = PermissionSelectOptionsCacheKey();
		const cached = await Cache.get<PermissionSelectOptions[]>(key);
		if (cached) return cached;

		const options = await PermissionRepository().selectOptions();
		await Cache.set(key, options, SELECT_OPTIONS_TTL_SECONDS);
		return options;
	},
	roleSelect: async (): Promise<{ id: string; name: string }[]> => {
		const key = RoleSelectOptionsCacheKey();
		const cached = await Cache.get<{ id: string; name: string }[]>(key);
		if (cached) return cached;

		const options = await RoleRepository().selectOptions();
		await Cache.set(key, options, SELECT_OPTIONS_TTL_SECONDS);
		return options;
	},
};
