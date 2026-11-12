import { Cache } from "./cache";
import {
	PermissionSelectOptionsCacheKey,
	RoleSelectOptionsCacheKey,
} from "./const";

export const SELECT_OPTIONS_TTL_SECONDS = 3600;

/**
 * Drops the cached select-option lists. Called after any role or permission
 * create, update or delete so the next read rebuilds them.
 */
export const forgetSelectOptions = async (): Promise<void> => {
	await Promise.all([
		Cache.delete(PermissionSelectOptionsCacheKey()),
		Cache.delete(RoleSelectOptionsCacheKey()),
	]);
};
