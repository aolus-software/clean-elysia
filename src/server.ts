import process from "node:process";

import { AppConfig } from "@config";
import { bootstraps } from "@modules";
import { DocsPlugin, ErrorHandlerPlugin, LocalePlugin } from "@plugins";
import { Elysia } from "elysia";

import { bootstrap } from "./bootstrap";

// Bootstrap DI container
bootstrap();

const app = new Elysia()
	.use(LocalePlugin)
	.use(DocsPlugin)
	.use(ErrorHandlerPlugin)
	.use(bootstraps)
	.listen(
		AppConfig.APP_REUSE_PORT
			? { port: AppConfig.APP_PORT, reusePort: true }
			: AppConfig.APP_PORT,
	);

export default app.fetch;

// eslint-disable-next-line no-console
console.log(
	`Api server worker ${process.pid} started on port: ${AppConfig.APP_PORT}`,
);
