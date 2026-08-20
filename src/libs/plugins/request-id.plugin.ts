import { Elysia } from "elysia";

export const RequestPlugin = new Elysia({ name: "request-id" }).derive(
	{ as: "global" },
	() => ({
		requestId:
			globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
		startedAt: Date.now(),
	}),
);
