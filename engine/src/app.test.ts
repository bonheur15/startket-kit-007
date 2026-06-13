import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { s } from "./core/schema";

const app = createApp();

describe("schema parser", () => {
	test("parses object schemas with coercion", () => {
		const schema = s.object({
			enabled: s.boolean({ coerce: true }),
			count: s.number({ coerce: true, integer: true }),
		});

		expect(schema.parse({ enabled: "true", count: "3" })).toEqual({
			enabled: true,
			count: 3,
		});
	});
});

describe("typed api runtime", () => {
	test("GET /api/v1/system/health returns health envelope", async () => {
		const response = await app.fetch(
			new Request("http://localhost/api/v1/system/health?verbose=true"),
		);
		const body = (await response.json()) as {
			ok: boolean;
			data: {
				status: string;
				checks?: {
					runtime: string;
				};
			};
		};

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.data.status).toBe("healthy");
		expect(body.data.checks?.runtime).toBe("bun");
	});

	test("GET /api/v1/system/ping-pong returns structured payload", async () => {
		const response = await app.fetch(
			new Request(
				"http://localhost/api/v1/system/ping-pong?message=hello&repeat=2",
			),
		);
		const body = (await response.json()) as {
			ok: boolean;
			data: {
				received: string;
				repeated: string[];
			};
		};

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.data.received).toBe("hello");
		expect(body.data.repeated).toEqual(["pong", "pong"]);
	});

	test("GET /openapi.json returns the generated document route", async () => {
		const response = await app.fetch(
			new Request("http://localhost/openapi.json"),
		);

		expect(response.status).toBe(200);
	});

	test("POST against GET-only endpoint returns 405", async () => {
		const response = await app.fetch(
			new Request("http://localhost/api/v1/system/health", { method: "POST" }),
		);

		expect(response.status).toBe(405);
		expect(response.headers.get("allow")).toBe("GET");
	});

	test("POST /api/v1/heavy-test returns coerced success responses", async () => {
		const payload = {
			unionField: 42,
			intersectionField: {
				id: "user-123",
				name: "Bob",
				age: "30", // Coerced from string to number
			},
			recordField: {
				key1: {
					role: "admin",
					joinedAt: "2026-05-23T00:00:00.000Z",
				},
			},
			dateField: "2026-05-23T00:00:00.000Z",
			arrayField: [
				{ sku: "item-A", price: "12.50" }, // Coerced from string to number
			],
			tupleField: ["first", "99"], // Coerced "99" in tuple
		};

		const response = await app.fetch(
			new Request("http://localhost/api/v1/heavy-test", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			}),
		);

		const body = (await response.json()) as {
			ok: boolean;
			data: {
				status: string;
				result: {
					echoedUnion: number;
					mergedInfo: { id: string; name: string; age: number };
					recordSummary: Record<string, string>;
					itemCount: number;
					tupleValue: [string, number];
				};
			};
		};

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.data.status).toBe("success");
		expect(body.data.result.echoedUnion).toBe(42);
		expect(body.data.result.mergedInfo.age).toBe(30);
		expect(body.data.result.itemCount).toBe(1);
		expect(body.data.result.tupleValue).toEqual(["first", 99]);
		expect(body.data.result.recordSummary.key1).toContain("admin");
	});

	test("POST /api/v1/heavy-test returns 400 bad request for invalid fields", async () => {
		const badPayload = {
			unionField: true, // Invalid (only string | number | null | undefined allowed)
			intersectionField: {
				id: "user-123",
				// Missing required 'name' field
			},
			recordField: {
				key1: {
					role: "guest", // Invalid enum role
					joinedAt: "2026-05-23T00:00:00.000Z",
				},
			},
			dateField: "2026-05-23T00:00:00.000Z",
			arrayField: [],
			tupleField: [],
		};

		const response = await app.fetch(
			new Request("http://localhost/api/v1/heavy-test", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(badPayload),
			}),
		);

		const body = (await response.json()) as {
			ok: boolean;
			error: {
				message: string;
				details?: {
					issues?: string[];
				};
			};
		};

		expect(response.status).toBe(400);
		expect(body.ok).toBe(false);
		expect(body.error.details?.issues).toBeDefined();
		expect(body.error.details?.issues?.length).toBeGreaterThan(0);
	});
});
