import { describe, expect, test } from "bun:test";
import { parseEnv } from "./env";

describe("parseEnv", () => {
	test("applies defaults for an empty environment", () => {
		const env = parseEnv({});
		expect(env.appEnv).toBe("development");
		expect(env.port).toBe(3000);
		expect(env.webUrl).toBe("http://localhost:5173");
		expect(env.corsOrigins).toEqual(["http://localhost:5173"]);
		expect(env.databaseDriver).toBe("postgres");
		expect(env.cookieSameSite).toBe("lax");
		expect(env.cookieSecure).toBe(false);
	});

	test("detects the neon driver from the connection string", () => {
		const env = parseEnv({
			DATABASE_URL: "postgres://u:p@ep-x.us-east-1.aws.neon.tech/db",
		});
		expect(env.databaseDriver).toBe("neon");
	});

	test("rejects SameSite=None without Secure", () => {
		expect(() =>
			parseEnv({ COOKIE_SAME_SITE: "none", COOKIE_SECURE: "false" }),
		).toThrow(/COOKIE_SECURE/);
	});

	test("rejects wildcard CORS in production", () => {
		expect(() =>
			parseEnv({
				NODE_ENV: "production",
				CORS_ORIGINS: "*",
				DATABASE_URL: "postgres://localhost/db",
			}),
		).toThrow(/CORS_ORIGINS/);
	});

	test("reports every problem at once", () => {
		let message = "";
		try {
			parseEnv({ PORT: "abc", LOG_LEVEL: "loud", GOOGLE_CLIENT_ID: "only-id" });
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message).toContain("PORT");
		expect(message).toContain("LOG_LEVEL");
		expect(message).toContain("GOOGLE_CLIENT_SECRET");
	});

	test("strips trailing slashes from URL lists", () => {
		const env = parseEnv({ CORS_ORIGINS: "https://a.com/, https://b.com" });
		expect(env.corsOrigins).toEqual(["https://a.com", "https://b.com"]);
	});
});
