import { beforeAll, describe, expect, test } from "bun:test";

import { queuedMails, request } from "../helpers/app";
import { login } from "../helpers/auth";
import { resetDatabase, SEED_PASSWORD } from "../helpers/database";

type LoginData = {
	accessToken: string;
	user: { email: string; roles: string[] };
};

beforeAll(resetDatabase);

describe("POST /auth/login", () => {
	test("returns an access token and the user for a seeded account", async () => {
		const response = await request<LoginData>("POST", "/auth/login", {
			body: { email: "admin@example.com", password: SEED_PASSWORD },
		});
		expect(response.status).toBe(200);
		expect(response.body.data?.accessToken).toBeString();
		expect(response.body.data?.user.email).toBe("admin@example.com");
		expect(response.body.data?.user.roles).toEqual(["admin"]);
	});

	test("answers 400 on email for a wrong password", async () => {
		const response = await request("POST", "/auth/login", {
			body: { email: "admin@example.com", password: "wrong-password" },
		});
		expect(response.status).toBe(400);
		expect(response.body.errors?.[0]?.field).toBe("email");
	});

	test("answers 422 for a malformed body", async () => {
		const response = await request("POST", "/auth/login", {
			body: { email: "not-an-email" },
		});
		expect(response.status).toBe(422);
		expect(response.body.success).toBe(false);
	});
});

describe("POST /auth/register", () => {
	test("creates the user and queues a verification mail", async () => {
		const before = queuedMails.length;
		const response = await request("POST", "/auth/register", {
			body: {
				name: "Jane",
				email: "jane@example.com",
				password: SEED_PASSWORD,
			},
		});
		expect(response.status).toBe(201);
		expect(queuedMails.length).toBe(before + 1);
		const mail = queuedMails[queuedMails.length - 1];
		expect(mail?.to).toBe("jane@example.com");
		expect(mail?.template).toBe("auth/email-verification");
	});

	test("answers 422 for a live duplicate email", async () => {
		const response = await request("POST", "/auth/register", {
			body: {
				name: "Admin",
				email: "admin@example.com",
				password: SEED_PASSWORD,
			},
		});
		expect(response.status).toBe(422);
		expect(response.body.errors?.[0]?.field).toBe("email");
	});

	test("an unverified user cannot log in", async () => {
		const response = await request("POST", "/auth/login", {
			body: { email: "jane@example.com", password: SEED_PASSWORD },
		});
		expect(response.status).toBe(400);
	});
});

describe("GET /profile", () => {
	test("answers 401 without a token", async () => {
		const response = await request("GET", "/profile");
		expect(response.status).toBe(401);
	});

	test("answers 401 for a garbage token", async () => {
		const response = await request("GET", "/profile", { token: "garbage" });
		expect(response.status).toBe(401);
	});

	test("returns the current user with roles and permissions", async () => {
		const token = await login("admin@example.com");
		const response = await request<{
			email: string;
			roles: string[];
			permissions: string[];
		}>("GET", "/profile", { token });
		expect(response.status).toBe(200);
		expect(response.body.data?.email).toBe("admin@example.com");
		expect(response.body.data?.roles).toEqual(["admin"]);
		expect(response.body.data?.permissions).toHaveLength(15);
	});
});
