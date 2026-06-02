import "dotenv/config";

import { bool, cleanEnv, host, num, port, str, url } from "envalid";

/**
 * Validates and parses all required environment variables at startup.
 * Fails fast with clear error messages if any required variable is missing or invalid.
 */
export const env = cleanEnv(process.env, {
	// App
	APP_NAME: str({ default: "Elysia App" }),
	APP_PORT: port({ default: 3000 }),
	APP_URL: url({ default: "http://localhost:3000" }),
	NODE_ENV: str({
		choices: ["development", "staging", "production"],
		default: "development",
	}),
	APP_TIMEZONE: str({ default: "UTC" }),
	APP_KEY: str({ default: "your-app-key" }),
	APP_JWT_SECRET: str({ default: "jwt-secret" }),
	LOG_LEVEL: str({
		choices: ["info", "warn", "debug"] as const,
		default: "info",
	}),

	// Cluster
	APP_CLUSTER_MODE: bool({ default: false }),
	APP_CLUSTER_WORKERS: num({ default: 0 }),

	// Reuse-port (SO_REUSEPORT) — run N independent processes on the same
	// port and let the kernel load-balance. Alternative to cluster mode;
	// do not enable both at once. Scale by launching N processes (e.g. PM2).
	APP_REUSE_PORT: bool({ default: false }),

	// Client
	CLIENT_URL: url({ default: "http://localhost:3000" }),

	// Database
	DATABASE_URL: str({
		default: "postgres://user:password@localhost:5432/mydb",
	}),

	// Redis
	REDIS_HOST: host({ default: "localhost" }),
	REDIS_PORT: port({ default: 6379 }),
	REDIS_PASSWORD: str({ default: "" }),
	REDIS_DB: num({ default: 0 }),

	// Mail
	MAIL_HOST: host({ default: "smtp.example.com" }),
	MAIL_PORT: port({ default: 587 }),
	MAIL_SECURE: str({ choices: ["true", "false"], default: "false" }),
	MAIL_FROM: str({ default: "Elysia <your_email@example.com>" }),
	MAIL_USER: str({ default: "your_email@example.com" }),
	MAIL_PASS: str({ default: "your_email_password" }),

	// JWT
	JWT_SECRET: str({ default: "your-secret-key" }),

	// CORS
	ALLOWED_HOST: str({ default: "" }),

	// ClickHouse
	CLICKHOUSE_HOST: url({ default: "http://localhost:8123" }),
	CLICKHOUSE_USER: str({ default: "default" }),
	CLICKHOUSE_PASSWORD: str({ default: "" }),
	CLICKHOUSE_DATABASE: str({ default: "default" }),
});
