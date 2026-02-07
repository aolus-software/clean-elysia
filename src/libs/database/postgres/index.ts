import { DatabaseConfig } from "@config";
import { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgTransaction } from "drizzle-orm/pg-core";
import { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { Pool } from "pg";

import { schema } from "./schema";

export * from "./schema/email-verification";
export * from "./schema/password-reset-token";
export * from "./schema/rbac";
export * from "./schema/user";

const connectionString = DatabaseConfig.url;
const client = new Pool({ connectionString });

const db = drizzle(client, { schema });

export { db, schema };

export type DbTransaction = PgTransaction<
	PostgresJsQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;
