import { AppConfig } from "@config";
import openapi from "@elysiajs/openapi";
import { Elysia } from "elysia";

export const DocsPlugin = new Elysia({ name: "docs" }).use(
	openapi({
		path: "/docs",
		enabled: AppConfig.APP_ENV !== "production",
		documentation: {
			info: {
				title: `API ${AppConfig.APP_NAME}`,
				version: "1.0.0",
				description: `API documentation for ${AppConfig.APP_NAME}`,
				license: {
					name: "MIT",
					url: "https://opensource.org/license/mit/",
				},
				contact: {},
			},
			security: [{ bearerAuth: [] }],
			components: {
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						bearerFormat: "JWT",
					},
				},
			},
		},
	}),
);
