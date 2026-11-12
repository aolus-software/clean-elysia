import { bootstraps } from "@modules";
import { DocsPlugin, ErrorHandlerPlugin, LocalePlugin } from "@plugins";
import { Elysia } from "elysia";

import { bootstrap } from "./bootstrap";

bootstrap();

/**
 * The composed application, not yet listening. `server.ts` binds it to a port;
 * the test suite drives it in-process through `app.handle(request)`.
 */
export const app = new Elysia()
	.use(LocalePlugin)
	.use(DocsPlugin)
	.use(ErrorHandlerPlugin)
	.use(bootstraps);
