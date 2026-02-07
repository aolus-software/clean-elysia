import { LoggerPlugin, RequestPlugin, SecurityPlugin } from "@plugins";
import { Elysia } from "elysia";

export const baseApp = new Elysia({ name: "base-app" })
	.use(RequestPlugin)
	.use(SecurityPlugin)
	.use(LoggerPlugin);
