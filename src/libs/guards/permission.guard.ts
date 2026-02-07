import { ForbiddenError } from "@errors";
import { UserInformation } from "@types";

export class PermissionGuard {
	static canActivate(
		user: UserInformation,
		requiredPermissions: string[],
	): boolean {
		const UserPermissions = user.permissions || [];
		if (user.roles.includes("superuser")) {
			return true;
		}

		const hasPermissions = requiredPermissions.every((permission) =>
			UserPermissions.includes(permission),
		);

		if (!hasPermissions) {
			throw new ForbiddenError(
				"You do not have the required permissions to access this resource.",
			);
		}

		return true;
	}
}
