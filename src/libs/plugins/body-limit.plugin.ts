import { Elysia } from "elysia";

/**
 * Body size limit plugin
 * Restricts the maximum size of request payloads
 * Default: 100KB
 */
export const BodyLimitPlugin = new Elysia({
	name: "body-limit",
}).onBeforeHandle({ as: "global" }, ({ request, set }) => {
	const contentLength = request.headers.get("content-length");
	const maxSize = 100 * 1024; // 100KB

	if (contentLength && parseInt(contentLength, 10) > maxSize) {
		set.status = 413;
		return {
			status: 413 as const,
			success: false as const,
			message: "Request body too large",
			data: null,
		};
	}

	return undefined;
});
