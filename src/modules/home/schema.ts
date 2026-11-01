import { t } from "elysia";

export const AppInfoSchema = t.Object({
	appName: t.String({
		description: "Application name",
		examples: ["clean-elysia"],
	}),
	appEnv: t.String({
		description: "Current environment",
		examples: ["development"],
	}),
	date: t.String({
		description: "Current server date",
		examples: ["2024-01-15T10:30:00Z"],
	}),
});

export const HealthCheckDataSchema = t.Object({
	status: t.String({
		description: "Overall health status",
		examples: ["healthy"],
	}),
	timestamp: t.String({
		description: "Check timestamp",
		examples: ["2024-01-15T10:30:00Z"],
	}),
	services: t.Object({
		database: t.String({
			description: "Database connection status",
			examples: ["connected"],
		}),
		redis: t.String({
			description: "Redis connection status",
			examples: ["connected"],
		}),
	}),
});

export const HealthCheckSuccessSchema = t.Object({
	status: t.Literal(200),
	message: t.String(),
	data: HealthCheckDataSchema,
	success: t.Literal(true),
});

export const HealthCheckErrorSchema = t.Object({
	status: t.Literal(503),
	message: t.String(),
	data: t.Null(),
	success: t.Literal(false),
});
