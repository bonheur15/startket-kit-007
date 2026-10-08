import { beforeEach, describe, expect, test } from "bun:test";
import { TEST_WEB_ORIGIN, useTestEnv } from "../../../test/helpers";
import { createApp } from "../../app";
import { resolveRedirectTarget } from "./google";

describe("google oauth", () => {
	beforeEach(() => useTestEnv());

	test("redirect targets are restricted to the web app and allowed origins", () => {
		expect(resolveRedirectTarget(null)).toBe(TEST_WEB_ORIGIN);
		expect(resolveRedirectTarget("/dashboard")).toBe(
			`${TEST_WEB_ORIGIN}/dashboard`,
		);
		expect(resolveRedirectTarget("//evil.example.net")).toBe(TEST_WEB_ORIGIN);
		expect(resolveRedirectTarget("https://evil.example.net/phish")).toBe(
			TEST_WEB_ORIGIN,
		);
		expect(resolveRedirectTarget("https://preview.example.com/x")).toBe(
			"https://preview.example.com/x",
		);
	});

	test("login redirects to the web app with an error when not configured", async () => {
		const app = createApp();
		const response = await app.fetch(
			new Request("http://x/api/auth/google/login"),
		);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			`${TEST_WEB_ORIGIN}/?auth_error=google_not_configured`,
		);
	});

	test("login sets a state cookie and redirects to Google with PKCE", async () => {
		useTestEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
		const app = createApp();
		const response = await app.fetch(
			new Request("http://x/api/auth/google/login?redirect=/dashboard"),
		);
		expect(response.status).toBe(302);
		const location = new URL(response.headers.get("location") ?? "");
		expect(location.hostname).toBe("accounts.google.com");
		expect(location.searchParams.get("code_challenge_method")).toBe("S256");
		expect(location.searchParams.get("state")).toBeString();
		expect(response.headers.get("set-cookie")).toContain("oauth_state=");
		expect(response.headers.get("set-cookie")).toContain("HttpOnly");
	});

	test("callback rejects a mismatched state", async () => {
		useTestEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
		const app = createApp();
		const response = await app.fetch(
			new Request("http://x/api/auth/google/callback?code=abc&state=forged", {
				headers: {
					cookie: `oauth_state=${encodeURIComponent(JSON.stringify({ state: "real", verifier: "v", redirect: "/" }))}`,
				},
			}),
		);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toContain(
			"auth_error=invalid_state",
		);
	});
});
