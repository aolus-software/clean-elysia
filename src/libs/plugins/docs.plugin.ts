import { AppConfig } from "@config";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

export const DocsPlugin = new Elysia({ name: "docs" }).use(
	openapi({
		path: "/docs",
		enabled: AppConfig.ENABLE_API_DOCS,
		provider: "scalar",
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
				parameters: {
					AcceptLanguage: {
						name: "Accept-Language",
						in: "header",
						description: "Preferred language for the response",
						required: false,
						schema: {
							type: "string",
							enum: ["en", "id"],
							default: "en",
						},
					},
				},
			},
		},
	}),
);
