import { Elysia } from "elysia";

import { log } from "../utils/elysia/logger";
import { RequestPlugin } from "./request-id.plugin";

/**
 * Performance logging plugin
 * Logs request duration and warns on slow requests
 * Composes RequestPlugin, which supplies the startedAt timestamp this reads.
 * Elysia dedupes by plugin name, so RequestPlugin is not applied twice.
 */
export const PerformancePlugin = new Elysia({
	name: "performance",
})
	.use(RequestPlugin)
	.onAfterHandle({ as: "global" }, ({ request, set, startedAt }) => {
		const duration = startedAt ? Date.now() - startedAt : 0;
		const url = new URL(request.url);
		const method = request.method;
		const path = url.pathname;
		const status = set.status ?? 200;

		const logData = {
			method,
			path,
			status,
			duration: `${duration}ms`,
		};

		if (duration > 1000) {
			log.warn(logData, "Slow request detected");
		} else if (duration > 500) {
			log.info(logData, "Request completed");
		} else {
			log.debug(logData, "Request completed");
		}
	});
