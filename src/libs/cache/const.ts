export const UserInformationCacheKey = (userId: string) => `user:${userId}`;

export const PermissionSelectOptionsCacheKey = (): string =>
	"select_options:permissions";

export const RoleSelectOptionsCacheKey = (): string => "select_options:roles";
