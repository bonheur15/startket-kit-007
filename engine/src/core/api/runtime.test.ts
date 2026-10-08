import { beforeEach, describe, expect, test } from "bun:test";
import {
	type ErrorBody,
	readJson,
	type SuccessBody,
	TEST_WEB_ORIGIN,
	useTestEnv,
} from "../../../test/helpers";
import { s } from "../schema";
import { errors } from "./error";
import { createRuntime } from "./runtime";

function createTestRuntime() {
	return createRuntime({
		endpoints: [
			{
				operationId: "getEcho",
				method: "GET",
				path: "/api/v1/echo",
				inputSource: "query",
				inputOptional: true,
				pathParamNames: [],
				inputSchema: s.optional(
					s.object({ n: s.optional(s.number({ coerce: true })) }),
				),
				responseSchema: s.object({ n: s.number() }),
				handler: (input?: { n?: number }) => ({ n: input?.n ?? 0 }),
			},
			{
				operationId: "getItem",
				method: "GET",
				path: "/api/v1/items/:id",
				inputSource: "query",
				pathParamNames: ["id"],
				inputSchema: s.object({ id: s.number({ coerce: true }) }),
				responseSchema: s.object({ id: s.number() }),
				handler: (input: { id: number }) => ({ id: input.id }),
			},
			{
				operationId: "createItem",
				method: "POST",
				path: "/api/v1/items",
				inputSource: "body",
				pathParamNames: [],
				inputSchema: s.object({ name: s.string() }),
				responseSchema: s.object({ name: s.string() }),
				handler: (input: { name: string }) => ({ name: input.name }),
			},
			{
				operationId: "getBroken",
				method: "GET",
				path: "/api/v1/broken",
				inputSource: "none",
				pathParamNames: [],
				responseSchema: s.object({ value: s.number() }),
				handler: () => ({ value: "not a number" }),
			},
			{
				operationId: "getBoom",
				method: "GET",
				path: "/api/v1/boom",
				inputSource: "none",
				pathParamNames: [],
				responseSchema: s.object({}),
				handler: () => {
					throw new Error("secret internal detail");
				},
			},
			{
				operationId: "getMissing",
				method: "GET",
				path: "/api/v1/missing",
				inputSource: "none",
				pathParamNames: [],
				responseSchema: s.object({}),
				handler: () => {
					throw errors.notFound("Nothing here");
				},
			},
		],
		rawRoutes: [
			{
				method: "POST",
				pattern: "/api/webhooks/:provider",
				handler: (context, params) =>
					Response.json({
						provider: params.provider,
						requestId: context.requestId,
					}),
			},
		],
	});
}

describe("runtime", () => {
	beforeEach(() => useTestEnv());

	test("GET with coerced query input", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(new Request("http://x/api/v1/echo?n=5"));
		const body = await readJson<SuccessBody<{ n: number }>>(response);
		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.data.n).toBe(5);
		expect(body.meta.requestId).toBeString();
	});

	test("path parameters are merged into the input and coerced", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(new Request("http://x/api/v1/items/42"));
		const body = await readJson<SuccessBody<{ id: number }>>(response);
		expect(body.data.id).toBe(42);
	});

	test("trailing slashes are tolerated", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(new Request("http://x/api/v1/echo/"));
		expect(response.status).toBe(200);
	});

	test("HEAD behaves like GET without a body", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(
			new Request("http://x/api/v1/echo", { method: "HEAD" }),
		);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
	});

	test("invalid input returns 400 with issues", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(new Request("http://x/api/v1/echo?n=abc"));
		const body = await readJson<ErrorBody>(response);
		expect(response.status).toBe(400);
		expect(body.error.code).toBe("BAD_REQUEST");
		expect(body.error.details?.issues?.[0]).toContain("$.input.n");
	});

	test("POST requires JSON content type", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(
			new Request("http://x/api/v1/items", { method: "POST", body: "name=x" }),
		);
		expect(response.status).toBe(415);
	});

	test("POST rejects malformed JSON", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(
			new Request("http://x/api/v1/items", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{not json",
			}),
		);
		const body = await readJson<ErrorBody>(response);
		expect(response.status).toBe(400);
		expect(body.error.code).toBe("INVALID_JSON");
	});

	test("oversized bodies are rejected with 413", async () => {
		useTestEnv({ MAX_BODY_BYTES: "1024" });
		const app = createTestRuntime();
		const response = await app.fetch(
			new Request("http://x/api/v1/items", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "x".repeat(5000) }),
			}),
		);
		expect(response.status).toBe(413);
	});

	test("unknown routes return 404 and wrong methods 405 with Allow", async () => {
		const app = createTestRuntime();
		const missing = await app.fetch(new Request("http://x/api/v1/nope"));
		expect(missing.status).toBe(404);

		const wrongMethod = await app.fetch(
			new Request("http://x/api/v1/echo", { method: "POST" }),
		);
		expect(wrongMethod.status).toBe(405);
		expect(wrongMethod.headers.get("allow")).toBe("GET");
	});

	test("response validation failures become 500 and never leak data", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(new Request("http://x/api/v1/broken"));
		const body = await readJson<ErrorBody>(response);
		expect(response.status).toBe(500);
		expect(body.error.message).toBe("Response validation failed");
	});

	test("response validation can be disabled", async () => {
		useTestEnv({ VALIDATE_RESPONSES: "false" });
		const app = createTestRuntime();
		const response = await app.fetch(new Request("http://x/api/v1/broken"));
		expect(response.status).toBe(200);
	});

	test("unexpected errors are masked, ApiErrors are passed through", async () => {
		const app = createTestRuntime();
		const boom = await readJson<ErrorBody>(
			await app.fetch(new Request("http://x/api/v1/boom")),
		);
		expect(boom.error.code).toBe("INTERNAL_SERVER_ERROR");
		expect(JSON.stringify(boom)).not.toContain("secret internal detail");

		const missing = await app.fetch(new Request("http://x/api/v1/missing"));
		const body = await readJson<ErrorBody>(missing);
		expect(missing.status).toBe(404);
		expect(body.error.message).toBe("Nothing here");
	});

	test("raw routes with patterns receive params and context", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(
			new Request("http://x/api/webhooks/stripe", { method: "POST" }),
		);
		const body = await readJson<{ provider: string; requestId: string }>(
			response,
		);
		expect(body.provider).toBe("stripe");
		expect(body.requestId).toBeString();
	});

	test("client request ids are honoured only when well-formed", async () => {
		const app = createTestRuntime();
		const good = await app.fetch(
			new Request("http://x/api/v1/echo", {
				headers: { "x-request-id": "trace-123" },
			}),
		);
		expect(good.headers.get("x-request-id")).toBe("trace-123");

		const bad = await app.fetch(
			new Request("http://x/api/v1/echo", {
				headers: { "x-request-id": "<script>" },
			}),
		);
		expect(bad.headers.get("x-request-id")).not.toBe("<script>");
	});

	test("security headers are present", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(new Request("http://x/api/v1/echo"));
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	test("openapi document is served with the request origin as server", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(new Request("http://x/openapi.json"));
		const body = await readJson<{
			openapi: string;
			servers: { url: string }[];
			paths: Record<string, unknown>;
		}>(response);
		expect(body.openapi).toBe("3.1.0");
		expect(body.servers[0]?.url).toBe("http://x");
		expect(body.paths["/api/v1/items/{id}"]).toBeDefined();
	});
});

describe("cors", () => {
	beforeEach(() => useTestEnv());

	test("allowed origins are echoed with credentials", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(
			new Request("http://x/api/v1/echo", {
				headers: { origin: TEST_WEB_ORIGIN },
			}),
		);
		expect(response.headers.get("access-control-allow-origin")).toBe(
			TEST_WEB_ORIGIN,
		);
		expect(response.headers.get("access-control-allow-credentials")).toBe(
			"true",
		);
	});

	test("wildcard subdomains match", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(
			new Request("http://x/api/v1/echo", {
				headers: { origin: "https://preview-1.example.com" },
			}),
		);
		expect(response.headers.get("access-control-allow-origin")).toBe(
			"https://preview-1.example.com",
		);
	});

	test("unknown origins get no CORS headers", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(
			new Request("http://x/api/v1/echo", {
				headers: { origin: "https://evil.example.net" },
			}),
		);
		expect(response.headers.get("access-control-allow-origin")).toBeNull();
		expect(response.headers.get("access-control-allow-credentials")).toBeNull();
	});

	test("preflight returns 204", async () => {
		const app = createTestRuntime();
		const response = await app.fetch(
			new Request("http://x/api/v1/items", {
				method: "OPTIONS",
				headers: {
					origin: TEST_WEB_ORIGIN,
					"access-control-request-method": "POST",
				},
			}),
		);
		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-methods")).toContain(
			"POST",
		);
	});
});
