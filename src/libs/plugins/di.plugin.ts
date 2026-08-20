import { Elysia } from "elysia";

import { container } from "./core/container";

/**
 * Dependency Injection plugin
 * Injects the DI container into the Elysia context for service resolution
 */
export const DiPlugin = new Elysia({ name: "di" }).derive(
	{ as: "global" },
	() => ({
		container,
	}),
);
