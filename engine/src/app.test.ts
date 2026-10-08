import { beforeEach, describe, expect, test } from "bun:test";
import {
	type ErrorBody,
	readJson,
	type SuccessBody,
	useTestEnv,
} from "../test/helpers";
import { createApp } from "./app";

describe("generated application", () => {
	beforeEach(() => useTestEnv());

	test("GET /api/v1/system/health returns the health envelope", async () => {
		const app = createApp();
		const response = await app.fetch(
			new Request("http://x/api/v1/system/health?verbose=true"),
		);
		const body =
			await readJson<
				SuccessBody<{ status: string; checks?: { runtime: string } }>
			>(response);
		expect(response.status).toBe(200);
		expect(body.data.status).toBe("healthy");
		expect(body.data.checks?.runtime).toBe("bun");
	});

	test("GET /api/v1/system/ping-pong coerces numbers from the query string", async () => {
		const app = createApp();
		const response = await app.fetch(
			new Request("http://x/api/v1/system/ping-pong?message=hello&repeat=2"),
		);
		const body =
			await readJson<SuccessBody<{ received: string; repeated: string[] }>>(
				response,
			);
		expect(body.data.received).toBe("hello");
		expect(body.data.repeated).toEqual(["pong", "pong"]);
	});

	test("protected endpoints return 401 without a session (and never touch the database)", async () => {
		const app = createApp();
		const response = await app.fetch(new Request("http://x/api/v1/todos"));
		const body = await readJson<ErrorBody>(response);
		expect(response.status).toBe(401);
		expect(body.error.code).toBe("UNAUTHORIZED");
	});

	test("validation runs before the handler", async () => {
		const app = createApp();
		const response = await app.fetch(
			new Request("http://x/api/v1/todos/create", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ title: 123 }),
			}),
		);
		expect(response.status).toBe(400);
	});

	test("POST /api/v1/examples/complex coerces nested values", async () => {
		const app = createApp();
		const response = await app.fetch(
			new Request("http://x/api/v1/examples/complex", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					unionField: 42,
					intersectionField: { id: "user-123", name: "Bob", age: "30" },
					recordField: {
						key1: { role: "admin", joinedAt: "2026-05-23T00:00:00.000Z" },
					},
					dateField: "2026-05-23T00:00:00.000Z",
					arrayField: [{ sku: "item-A", price: "12.50" }],
					tupleField: ["first", "99"],
				}),
			}),
		);
		const body =
			await readJson<
				SuccessBody<{
					result: {
						mergedInfo: { age: number };
						tupleValue: [string, number];
						processedAt?: string;
					};
				}>
			>(response);
		expect(response.status).toBe(200);
		expect(body.data.result.mergedInfo.age).toBe(30);
		expect(body.data.result.tupleValue).toEqual(["first", 99]);
	});

	test("POST /api/v1/examples/complex rejects invalid fields with issue paths", async () => {
		const app = createApp();
		const response = await app.fetch(
			new Request("http://x/api/v1/examples/complex", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					unionField: true,
					intersectionField: { id: "user-123" },
					recordField: {
						key1: { role: "guest", joinedAt: "2026-05-23T00:00:00.000Z" },
					},
					dateField: "2026-05-23T00:00:00.000Z",
					arrayField: [],
					tupleField: [],
				}),
			}),
		);
		const body = await readJson<ErrorBody>(response);
		expect(response.status).toBe(400);
		expect(body.error.details?.issues?.length).toBeGreaterThan(0);
	});

	test("GET /openapi.json documents auth requirements", async () => {
		const app = createApp();
		const body = await readJson<{
			paths: Record<
				string,
				{ get?: { security?: unknown[]; summary: string } }
			>;
		}>(await app.fetch(new Request("http://x/openapi.json")));
		expect(body.paths["/api/v1/todos"]?.get?.security).toEqual([
			{ cookieAuth: [] },
		]);
		expect(body.paths["/api/v1/system/health"]?.get?.summary).toBe(
			"Liveness check.",
		);
	});
});
