import { JWT_CONFIG } from "@config";
import { jwt } from "@elysiajs/jwt";
import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

const userId = "550e8400-e29b-41d4-a716-446655440000";

/* AuthPlugin and POST /auth/login both sign with jwt(JWT_CONFIG). */
const signer = new Elysia().use(jwt(JWT_CONFIG)).decorator.jwt;
const foreign = new Elysia().use(jwt({ ...JWT_CONFIG, secret: "another" }))
	.decorator.jwt;

describe("JWT_CONFIG", () => {
	test("round-trips the user id and sets an expiry", async () => {
		const token = await signer.sign({ id: userId });
		const payload = await signer.verify(token);
		expect(payload && payload.id).toBe(userId);
		expect(payload && typeof payload.exp).toBe("number");
	});

	test("rejects a token signed with another secret", async () => {
		const token = await foreign.sign({ id: userId });
		expect(await signer.verify(token)).toBe(false);
	});

	test("rejects a malformed token", async () => {
		expect(await signer.verify("not.a.token")).toBe(false);
	});
});
