import { resetEnv } from "../src/config/env";
import { resetCorsCache } from "../src/core/http/cors";

export const TEST_WEB_ORIGIN = "http://localhost:5173";

/** Apply a known environment for tests and reset cached config. */
export function useTestEnv(overrides: Record<string, string | undefined> = {}) {
	const base: Record<string, string> = {
		NODE_ENV: "test",
		LOG_LEVEL: "silent",
		LOG_FORMAT: "json",
		WEB_URL: TEST_WEB_ORIGIN,
		API_URL: "http://localhost:3000",
		CORS_ORIGINS: `${TEST_WEB_ORIGIN},https://*.example.com`,
		COOKIE_SAME_SITE: "lax",
	};
	for (const key of Object.keys(base)) delete process.env[key];
	for (const [key, value] of Object.entries({ ...base, ...overrides })) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	resetEnv();
	resetCorsCache();
}

export async function readJson<T>(response: Response): Promise<T> {
	return (await response.json()) as T;
}

export type ErrorBody = {
	ok: false;
	error: {
		code: string;
		message: string;
		details?: { issues?: string[]; allow?: string };
	};
	meta: { requestId: string };
};

export type SuccessBody<T> = {
	ok: true;
	data: T;
	meta: { requestId: string; timestamp: string };
};
