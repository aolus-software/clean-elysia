import { createClient } from "@clickhouse/client";
import { clickhouseConfig } from "@packages_config/*";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

interface IMigrationFile {
	version: string;
	name: string;
	path: string;
}

class ClickHouseMigrator {
	private client;
	private migrationsDir = join(process.cwd(), "infra/clickhouse/migrations");

	constructor() {
		this.client = createClient({
			url: clickhouseConfig.host,
			username: clickhouseConfig.user,
			password: clickhouseConfig.password,
			database: clickhouseConfig.database,
		});
	}

	async initialize() {
		// eslint-disable-next-line no-console
		console.log("creating schema_migrations table if not exists...");
		await this.client.query({
			query: `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version String,
          name String,
          executed_at DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY version
      `,
		});
	}

	async getExecutedMigrations(): Promise<string[]> {
		const rs = await this.client.query({
			query: `SELECT version FROM schema_migrations ORDER BY version`,
			format: "JSONEachRow",
		});

		const rows = await rs.json<{ version: string }>();
		return rows.map((r) => r.version);
	}

	async getMigrationFiles(): Promise<Array<IMigrationFile>> {
		const files = await readdir(this.migrationsDir);
		const migrations = files
			.filter((f) => f.endsWith(".sql"))
			.map((f) => {
				const [version, ...nameParts] = f.replace(".sql", "").split("_");
				return {
					version,
					name: nameParts.join("_"),
					path: join(this.migrationsDir, f),
				};
			})
			.sort((a, b) => a.version.localeCompare(b.version));

		return migrations;
	}

	async executeMigration(migration: IMigrationFile) {
		// eslint-disable-next-line no-console
		console.log(`Executing migration ${migration.version}_${migration.name}`);

		const sql = await readFile(migration.path, "utf-8");

		// Split by semicolon and execute each statement
		const statements = sql
			.split(";")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		for (const statement of statements) {
			await this.client.query({ query: statement });
		}

		await this.client.insert({
			table: "schema_migrations",
			values: [{ version: migration.version, name: migration.name }],
			format: "JSONEachRow",
		});

		// eslint-disable-next-line no-console
		console.log(`✓ Migration ${migration.version}_${migration.name} completed`);
	}

	async migrate() {
		await this.initialize();

		const executedMigrations = await this.getExecutedMigrations();
		const allMigrations = await this.getMigrationFiles();

		const pendingMigrations = allMigrations.filter(
			(m) => !executedMigrations.includes(m.version),
		);

		if (pendingMigrations.length === 0) {
			// eslint-disable-next-line no-console
			console.log("No pending migrations");
			return;
		}

		// eslint-disable-next-line no-console
		console.log(`Found ${pendingMigrations.length} pending migrations`);

		for (const migration of pendingMigrations) {
			await this.executeMigration(migration);
		}

		// eslint-disable-next-line no-console
		console.log("All migrations completed successfully");
	}
}

// CLI runner
async function main() {
	const migrator = new ClickHouseMigrator();
	const command = process.argv[2];

	let executed: string[] = [];
	let all: Array<IMigrationFile> = [];
	let pending: Array<IMigrationFile> = [];

	switch (command) {
		case "migrate":
			await migrator.migrate();
			break;
		case "status":
			await migrator.initialize();
			executed = await migrator.getExecutedMigrations();
			all = await migrator.getMigrationFiles();
			pending = all.filter((m) => !executed.includes(m.version));

			// eslint-disable-next-line no-console
			console.log(`Executed: ${executed.length}`);
			// eslint-disable-next-line no-console
			console.log(`Pending: ${pending.length}`);

			if (pending.length > 0) {
				// eslint-disable-next-line no-console
				console.log("Pending migrations:");

				// eslint-disable-next-line no-console
				pending.forEach((m) => console.log(`  - ${m.version}_${m.name}`));
			}
			break;
		default:
			// eslint-disable-next-line no-console
			console.log("Usage: npm run migrate:clickhouse [migrate|status]");
	}

	process.exit(0);
}

if (require.main === module) {
	// eslint-disable-next-line no-console
	main().catch(console.error);
}

export { ClickHouseMigrator };
