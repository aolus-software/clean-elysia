import { AppConfig } from "@config";
import { bootstraps } from "@modules";
import { DocsPlugin, ErrorHandlerPlugin } from "@plugins";
import { Elysia } from "elysia";

const app = new Elysia()
	.use(DocsPlugin)
	.use(ErrorHandlerPlugin)
	.use(bootstraps)
	.listen(AppConfig.APP_PORT);

export default app.fetch;

// eslint-disable-next-line no-console
console.log("Api server started on port: ", AppConfig.APP_PORT);
