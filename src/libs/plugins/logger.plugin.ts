import { wrap } from "@bogeychan/elysia-logger";
import { log } from "@utils";
import { Elysia } from "elysia";

import { RequestPlugin } from "./request-id.plugin";

/**
 * Elysia plugin: exposes ctx.log with request-scoped props and writes one
 * access line per request. The library's autoLogging is off because it logs
 * the whole context (jwt, container, headers); the access line carries only
 * method, path, status, duration and request id.
 */
export const LoggerPlugin = new Elysia({ name: "logger" })
	.use(RequestPlugin)
	.use(
		wrap(log, {
			autoLogging: false,
			customProps(ctx) {
				const url = new URL(ctx.request.url);
				return {
					// eslint-disable-next-line
					requestId: (ctx as any).requestId,
					method: ctx.request.method,
					path: url.pathname,
					route: ctx.route,
				};
			},
		}),
	)
	.onAfterResponse(
		{ as: "global" },
		({ request, set, requestId, startedAt }) => {
			log.info(
				{
					requestId,
					method: request.method,
					path: new URL(request.url).pathname,
					status: set.status ?? 200,
					duration: `${startedAt ? Date.now() - startedAt : 0}ms`,
				},
				"Request completed",
			);
		},
	);
