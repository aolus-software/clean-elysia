import { db, roles, userRoles, users } from "@database";
import { Hash } from "@utils";
import { eq } from "drizzle-orm";

export const UserSeeder = async () => {
	await db.transaction(async (tx) => {
		await tx.insert(users).values({
			name: "superuser",
			email: "superuser@example.com",
			email_verified_at: new Date(),
			password: await Hash.generateHash("password"),
		});

		await tx.insert(users).values({
			name: "admin",
			email: "admin@example.com",
			email_verified_at: new Date(),
			password: await Hash.generateHash("password"),
		});

		// get created user
		const superUser = await tx
			.select()
			.from(users)
			.where(eq(users.name, "superuser"))
			.limit(1);
		const admin = await tx
			.select()
			.from(users)
			.where(eq(users.name, "admin"))
			.limit(1);

		// assign role
		const superUserRole = await tx
			.select()
			.from(roles)
			.where(eq(roles.name, "superuser"))
			.limit(1);
		const adminRole = await tx
			.select()
			.from(roles)
			.where(eq(roles.name, "admin"))
			.limit(1);

		if (superUserRole[0] && superUser[0]) {
			await tx.insert(userRoles).values({
				user_id: superUser[0].id,
				role_id: superUserRole[0].id,
			});
		}

		if (adminRole[0] && admin[0]) {
			await tx.insert(userRoles).values({
				user_id: admin[0].id,
				role_id: adminRole[0].id,
			});
		}
	});
};
