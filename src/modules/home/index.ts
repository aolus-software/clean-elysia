import { AppConfig } from "@config";
import { db, RedisClient } from "@database";
import { DateToolkit, ResponseToolkit, SuccessResponseSchema } from "@utils";
import { Elysia, t } from "elysia";

import { baseApp } from "../../base";
import {
	AppInfoSchema,
	HealthCheckErrorSchema,
	HealthCheckSuccessSchema,
} from "./schema";

export const HomeModule = new Elysia({
	detail: { tags: ["General"], security: [], description: "General APIs" },
})
	.use(baseApp)
	// ============================================
	// ROOT ENDPOINT
	// ============================================
	.get(
		"/",
		() => {
			return ResponseToolkit.success(
				{
					app_name: AppConfig.APP_NAME,
					app_env: AppConfig.APP_ENV,
					date: DateToolkit.getDateTimeInformativeWithTimezone(
						DateToolkit.now(),
					),
				},
				`Welcome to ${AppConfig.APP_NAME}`,
			);
		},
		{
			response: {
				200: SuccessResponseSchema(AppInfoSchema),
			},
			detail: {
				summary: "API root endpoint",
				description: "Returns basic information about the API",
			},
		},
	)

	// ============================================
	// HEALTH CHECK
	// ============================================
	.get(
		"/health",
		async ({ set }) => {
			const healthStatus = {
				status: "healthy",
				timestamp: DateToolkit.getDateTimeInformativeWithTimezone(
					DateToolkit.now(),
				),
				services: {
					database: "healthy",
					redis: "healthy",
				},
			};

			// Check Redis
			try {
				const redis = RedisClient.getRedisClient();
				await redis.ping();
				healthStatus.services.redis = "healthy";
			} catch {
				healthStatus.services.redis = "unhealthy";
				healthStatus.status = "degraded";
			}

			// Check Database
			try {
				await db.execute(`SELECT 1`);
				healthStatus.services.database = "healthy";
			} catch {
				healthStatus.services.database = "unhealthy";
				healthStatus.status = "degraded";
			}

			// Set appropriate status code
			if (healthStatus.status === "degraded") {
				set.status = 503;
				return {
					status: 503,
					message: "Service partially unavailable",
					data: null,
					success: false,
				};
			}

			return {
				status: 200,
				message: "All systems operational",
				data: healthStatus,
				success: true,
			};
		},
		{
			response: {
				200: HealthCheckSuccessSchema,
				503: HealthCheckErrorSchema,
			},
			detail: {
				summary: "Health check",
				description: "Check the health status of all services",
			},
		},
	)

	// ============================================
	// LIVENESS CHECK
	// ============================================
	.get(
		"/live",
		() => {
			// Simple check that the service is running
			return ResponseToolkit.success({ alive: true }, "Service is alive");
		},
		{
			response: {
				200: SuccessResponseSchema(t.Object({ alive: t.Boolean() })),
			},
			detail: {
				summary: "Liveness check",
				description: "Check if the service is alive",
			},
		},
	);
