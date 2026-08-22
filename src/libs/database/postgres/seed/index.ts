import { log } from "@utils";

import { seedPermissions } from "./permission.seed";
import { seedRoles } from "./role.seed";
import { seedUsers } from "./user.seed";

/* Order matters: roles grant the permissions seeded before them, and users are
   assigned the roles seeded before them. */
const seed = async (): Promise<void> => {
	await seedPermissions();
	await seedRoles();
	await seedUsers();
};

seed()
	.then(() => {
		log.info("Seeding completed successfully");
		process.exit(0);
	})
	.catch((error: unknown) => {
		log.error({ error }, "Seeding failed");
		process.exit(1);
	});
