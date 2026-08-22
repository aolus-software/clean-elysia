import { db, roles, userRoles, users } from "@database";
import { Hash, log } from "@utils";
import { and, eq, isNull } from "drizzle-orm";

import { roleNames } from "./role.seed";

/**
 * Seeds one pre-verified account per baseline role, each holding the role of
 * the same name.
 *
 * Existing accounts are skipped rather than updated, so a re-run never rewrites
 * a password an operator has since changed. `users.email` carries no unique
 * constraint — a soft-deleted user's address has to be reusable — so the lookup
 * filters `deleted_at` itself rather than relying on onConflictDoNothing.
 */
export async function seedUsers(): Promise<void> {
	for (const name of roleNames) {
		const email = `${name}@example.com`;

		const [existingUser] = await db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.email, email), isNull(users.deleted_at)))
			.limit(1);

		if (existingUser) {
			continue;
		}

		const [user] = await db
			.insert(users)
			.values({
				name,
				email,
				password: await Hash.generateHash("password"),
				email_verified_at: new Date(),
			})
			.returning({ id: users.id });

		if (!user) {
			continue;
		}

		const [role] = await db
			.select({ id: roles.id })
			.from(roles)
			.where(eq(roles.name, name))
			.limit(1);

		if (!role) {
			continue;
		}

		await db
			.insert(userRoles)
			.values({ user_id: user.id, role_id: role.id })
			.onConflictDoNothing();
	}

	log.info({ users: roleNames.length }, "User seeding completed");
}
