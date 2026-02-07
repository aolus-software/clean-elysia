import { ForbiddenError } from "@errors";
import { UserInformation } from "@types";

export class RoleGuard {
	static canActivate(user: UserInformation, requiredRoles: string[]): boolean {
		if (user.roles.includes("superuser")) {
			return true;
		}

		const userRoles = user.roles || [];
		const hasRoles = requiredRoles.every((role) => userRoles.includes(role));

		if (!hasRoles) {
			throw new ForbiddenError(
				"You do not have the required roles to access this resource.",
			);
		}

		return true;
	}
}
