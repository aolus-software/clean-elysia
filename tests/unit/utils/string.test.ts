import { StrToolkit } from "@utils";
import { describe, expect, test } from "bun:test";

describe("StrToolkit.random", () => {
	test("returns the requested length from the alphanumeric set", () => {
		const value = StrToolkit.random(64);
		expect(value).toHaveLength(64);
		expect(value).toMatch(/^[A-Za-z0-9]+$/);
	});

	test("does not repeat", () => {
		expect(StrToolkit.random(32)).not.toBe(StrToolkit.random(32));
	});
});

describe("StrToolkit case helpers", () => {
	test("converts between cases", () => {
		expect(StrToolkit.camel("foo_bar-baz")).toBe("fooBarBaz");
		expect(StrToolkit.snake("fooBar")).toBe("foo_bar");
		expect(StrToolkit.kebab("fooBar")).toBe("foo-bar");
		expect(StrToolkit.slug("Hello World!")).toBe("hello-world");
	});

	test("slices around a search string", () => {
		expect(StrToolkit.after("user@example.com", "@")).toBe("example.com");
		expect(StrToolkit.before("user@example.com", "@")).toBe("user");
		expect(StrToolkit.between("[value]", "[", "]")).toBe("value");
		expect(StrToolkit.after("plain", "@")).toBe("plain");
	});

	test("detects uuids", () => {
		expect(StrToolkit.isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(
			true,
		);
		expect(StrToolkit.isUuid("not-a-uuid")).toBe(false);
	});
});
