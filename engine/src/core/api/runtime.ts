import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "../../config/env";
import type { User } from "../../db/schema";
import { validateSession } from "../auth/sessions";
import { type OpenApiSchema, type Schema, SchemaError } from "../schema";
import { ApiError, isApiError } from "./error";

export type RequestStore = {
	request: Request;
	requestId: string;
	user: User | null;
	responseHeaders?: Headers;
};

export const requestStorage = new AsyncLocalStorage<RequestStore>();

function parseCookies(cookieHeader: string | null): Record<string, string> {
	if (!cookieHeader) return {};
	return cookieHeader.split(";").reduce(
		(acc, cookie) => {
			const [key, value] = cookie.trim().split("=");
			if (key && value) acc[key] = decodeURIComponent(value);
			return acc;
		},
		{} as Record<string, string>,
	);
}

async function authenticateRequest(request: Request): Promise<User | null> {
	try {
		const cookieHeader = request.headers.get("cookie");
		const cookies = parseCookies(cookieHeader);
		const token = cookies.session;
		if (!token) return null;
		return await validateSession(token);
	} catch (error) {
		console.error("Failed to authenticate request:", error);
		return null;
	}
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type EndpointModule = {
	operationId: string;
	method: HttpMethod;
	path: string;
	inputSource: "none" | "query" | "body";
	inputOptional?: boolean;
	pathParamNames: readonly string[];
	inputSchema?: Schema<unknown>;
	responseSchema: Schema<unknown>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a contravariance boundary marker for handler types
	handler: (input?: any) => unknown | Promise<unknown>;
};

type OpenApiOperation = {
	operationId: string;
	summary: string;
	description?: string;
	tags: string[];
	parameters?: Array<{
		in: "path" | "query";
		name: string;
		required: boolean;
		schema: OpenApiSchema;
	}>;
	requestBody?: {
		required: boolean;
		content: {
			"application/json": {
				schema: OpenApiSchema;
			};
		};
	};
	responses: Record<string, unknown>;
};

type RequestContext = {
	request: Request;
	requestId: string;
};

type SuccessEnvelope<T> = {
	ok: true;
	data: T;
	meta: {
		requestId: string;
		timestamp: string;
	};
};

type ErrorEnvelope = {
	ok: false;
	error: {
		code: string;
		message: string;
		details?: unknown;
	};
	meta: {
		requestId: string;
		timestamp: string;
	};
};

export type AppModule = {
	endpoints: EndpointModule[];
	rawFetch?: (
		request: Request,
	) => Response | Promise<Response | undefined> | undefined;
};

type RouteEntry = {
	endpoint: EndpointModule;
	pathPattern: RegExp;
	pathKeys: string[];
};

function normalizeQuery(
	searchParams: URLSearchParams,
): Record<string, unknown> {
	const query: Record<string, unknown> = {};

	for (const key of new Set(searchParams.keys())) {
		const values = searchParams.getAll(key);
		query[key] = values.length <= 1 ? values[0] : values;
	}

	return query;
}

function compilePath(path: string): {
	pathPattern: RegExp;
	pathKeys: string[];
} {
	const pathKeys: string[] = [];
	const pattern = path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
		pathKeys.push(key);
		return "([^/]+)";
	});

	return {
		pathPattern: new RegExp(`^${pattern}$`),
		pathKeys,
	};
}

function extractPathParams(
	route: RouteEntry,
	pathname: string,
): Record<string, string> | null {
	const match = route.pathPattern.exec(pathname);

	if (!match) {
		return null;
	}

	const params: Record<string, string> = {};

	for (const [index, key] of route.pathKeys.entries()) {
		params[key] = decodeURIComponent(match[index + 1] ?? "");
	}

	return params;
}

function createHeaders(requestId: string, origin?: string | null): Headers {
	const headers = new Headers();
	headers.set("content-type", "application/json; charset=utf-8");
	headers.set("x-request-id", requestId);

	const corsOrigin = env.corsOrigin === "*" ? (origin ?? "*") : env.corsOrigin;
	headers.set("access-control-allow-origin", corsOrigin);

	headers.set(
		"access-control-allow-methods",
		"GET,POST,PUT,PATCH,DELETE,OPTIONS",
	);
	headers.set(
		"access-control-allow-headers",
		"content-type,authorization,x-request-id,x-debug",
	);
	headers.set("access-control-allow-credentials", "true");
	headers.set("vary", "origin");
	return headers;
}

function json<T>(
	requestId: string,
	status: number,
	body: T,
	origin?: string | null,
): Response {
	return Response.json(body, {
		status,
		headers: createHeaders(requestId, origin),
	});
}

function createSuccessEnvelope<T>(
	requestId: string,
	data: T,
): SuccessEnvelope<T> {
	return {
		ok: true,
		data,
		meta: {
			requestId,
			timestamp: new Date().toISOString(),
		},
	};
}

function createErrorEnvelope(
	requestId: string,
	error: ApiError,
): ErrorEnvelope {
	return {
		ok: false,
		error: {
			code: error.code,
			message: error.message,
			details: error.details,
		},
		meta: {
			requestId,
			timestamp: new Date().toISOString(),
		},
	};
}

async function parseJsonBody(request: Request): Promise<unknown> {
	const contentType = request.headers.get("content-type") ?? "";

	if (!contentType.includes("application/json")) {
		throw new ApiError(
			415,
			"UNSUPPORTED_MEDIA_TYPE",
			"Expected application/json body",
		);
	}

	try {
		return await request.json();
	} catch {
		throw new ApiError(
			400,
			"INVALID_JSON",
			"Request body must contain valid JSON",
		);
	}
}

function requestLooksBodyless(request: Request): boolean {
	const contentLength = request.headers.get("content-length");
	const contentType = request.headers.get("content-type");

	return (contentLength === null || contentLength === "0") && !contentType;
}

function mergeInput(
	endpoint: EndpointModule,
	paramsRaw: Record<string, string>,
	queryRaw: Record<string, unknown>,
	bodyRaw: unknown,
): unknown {
	if (endpoint.inputSource === "none") {
		return undefined;
	}

	if (endpoint.inputSource === "query") {
		return {
			...paramsRaw,
			...queryRaw,
		};
	}

	return {
		...paramsRaw,
		...(typeof bodyRaw === "object" &&
		bodyRaw !== null &&
		!Array.isArray(bodyRaw)
			? (bodyRaw as Record<string, unknown>)
			: {}),
	};
}

async function executeEndpoint(
	route: RouteEntry,
	context: RequestContext,
): Promise<Response> {
	const startTime = performance.now();
	const isDebug =
		env.debugApi ||
		(env.appEnv !== "production" &&
			context.request.headers.get("x-debug") === "true");

	const url = new URL(context.request.url);
	const paramsRaw = extractPathParams(route, url.pathname);

	if (!paramsRaw) {
		throw new ApiError(404, "NOT_FOUND", "Route not found");
	}

	const queryRaw = normalizeQuery(url.searchParams);
	const bodyRaw =
		route.endpoint.inputSource === "body"
			? route.endpoint.inputOptional && requestLooksBodyless(context.request)
				? undefined
				: await parseJsonBody(context.request)
			: undefined;
	const rawInput = mergeInput(route.endpoint, paramsRaw, queryRaw, bodyRaw);
	const parsedInput = (() => {
		try {
			return route.endpoint.inputSchema
				? route.endpoint.inputSchema.parse(rawInput, "$.input")
				: undefined;
		} catch (error) {
			if (error instanceof SchemaError) {
				if (isDebug) {
					const durationMs = (performance.now() - startTime).toFixed(2);
					console.log(
						`\n[API DEBUG ERROR] ${route.endpoint.method} ${route.endpoint.path}`,
					);
					console.log(`  └─ Duration: ${durationMs}ms`);
					console.error(`  └─ Input Validation Failed:`, error.issues);
				}
				throw new ApiError(400, "BAD_REQUEST", "Validation failed", {
					issues: error.issues,
				});
			}
			throw error;
		}
	})();

	const data =
		parsedInput === undefined
			? await route.endpoint.handler()
			: await route.endpoint.handler(parsedInput);

	try {
		route.endpoint.responseSchema.parse(data, "$.response");
	} catch (error) {
		if (error instanceof SchemaError) {
			if (isDebug) {
				const durationMs = (performance.now() - startTime).toFixed(2);
				console.log(
					`\n[API DEBUG ERROR] ${route.endpoint.method} ${route.endpoint.path}`,
				);
				console.log(`  └─ Duration: ${durationMs}ms`);
				console.error(`  └─ Response Validation Failed:`, error.issues);
			}
			throw new ApiError(
				500,
				"INTERNAL_SERVER_ERROR",
				"Response validation failed",
				{
					issues: error.issues,
				},
			);
		}
		throw error;
	}

	if (isDebug) {
		const durationMs = (performance.now() - startTime).toFixed(2);
		console.log(
			`\n[API DEBUG] ${route.endpoint.method} ${route.endpoint.path}`,
		);
		console.log(`  ├─ Duration: ${durationMs}ms`);
		console.log(`  ├─ Path Params:`, paramsRaw);
		if (Object.keys(queryRaw).length > 0) console.log(`  ├─ Query:`, queryRaw);
		if (bodyRaw !== undefined) console.log(`  ├─ Body:`, bodyRaw);
		console.log(`  └─ Output Data:`, data);
	}

	const response = json(
		context.requestId,
		200,
		createSuccessEnvelope(context.requestId, data),
		context.request.headers.get("origin"),
	);

	const store = requestStorage.getStore();
	if (store?.responseHeaders) {
		for (const [key, value] of store.responseHeaders.entries()) {
			response.headers.append(key, value);
		}
	}

	return response;
}

function createRootResponse(
	requestId: string,
	origin?: string | null,
): Response {
	return json(
		requestId,
		200,
		{
			ok: true,
			data: {
				service: env.appName,
				environment: env.appEnv,
				apiVersion: env.apiVersion,
				docs: "/openapi.json",
			},
			meta: {
				requestId,
				timestamp: new Date().toISOString(),
			},
		},
		origin,
	);
}

function createOpenApiResponse(
	requestId: string,
	document: Record<string, unknown>,
	request: Request,
	origin?: string | null,
): Response {
	const url = new URL(request.url);

	return json(
		requestId,
		200,
		{
			...document,
			servers: [{ url: url.origin }],
		},
		origin,
	);
}

function omitOpenApiProperties(
	schema: OpenApiSchema,
	keys: readonly string[],
): OpenApiSchema {
	if (!isObjectOpenApiSchema(schema) || !schema.properties) {
		return schema;
	}

	return {
		...schema,
		properties: Object.fromEntries(
			Object.entries(schema.properties).filter(([key]) => !keys.includes(key)),
		) as Record<string, OpenApiSchema>,
		required: (schema.required ?? []).filter(
			(key: string) => !keys.includes(key),
		),
	};
}

function isObjectOpenApiSchema(
	schema: OpenApiSchema,
): schema is OpenApiSchema & {
	type: "object";
	properties?: Record<string, OpenApiSchema>;
	required?: string[];
} {
	return "type" in schema && schema.type === "object";
}

export function createOpenApiDocument(endpoints: EndpointModule[]) {
	const paths: Record<string, Record<string, OpenApiOperation>> = {};

	for (const endpoint of endpoints) {
		const pathEntry = paths[endpoint.path] ?? {};
		paths[endpoint.path] = pathEntry;
		const parameters: OpenApiOperation["parameters"] = [];

		if (
			endpoint.inputSchema &&
			isObjectOpenApiSchema(endpoint.inputSchema.openapi)
		) {
			const requiredFields = new Set(
				endpoint.inputSchema.openapi.required ?? [],
			);

			for (const [name, schema] of Object.entries(
				endpoint.inputSchema.openapi.properties ?? {},
			) as Array<[string, OpenApiSchema]>) {
				if (endpoint.pathParamNames.includes(name)) {
					parameters.push({
						in: "path",
						name,
						required: true,
						schema,
					});
					continue;
				}

				if (endpoint.inputSource === "query") {
					parameters.push({
						in: "query",
						name,
						required: requiredFields.has(name),
						schema,
					});
				}
			}
		}

		pathEntry[endpoint.method.toLowerCase()] = {
			operationId: endpoint.operationId,
			summary: endpoint.operationId,
			description: undefined,
			tags: [],
			parameters: parameters.length > 0 ? parameters : undefined,
			requestBody:
				endpoint.inputSource === "body" && endpoint.inputSchema
					? {
							required: !endpoint.inputOptional,
							content: {
								"application/json": {
									schema: omitOpenApiProperties(
										endpoint.inputSchema.openapi,
										endpoint.pathParamNames,
									),
								},
							},
						}
					: undefined,
			responses: {
				"200": {
					description: "Successful response",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									ok: { const: true, type: "boolean" },
									data: endpoint.responseSchema.openapi,
									meta: {
										type: "object",
										properties: {
											requestId: { type: "string" },
											timestamp: { type: "string" },
										},
										required: ["requestId", "timestamp"],
										additionalProperties: false,
									},
								},
								required: ["ok", "data", "meta"],
								additionalProperties: false,
							},
						},
					},
				},
			},
		};
	}

	return {
		openapi: "3.1.0",
		info: {
			title: `${env.appName} API`,
			version: env.apiVersion,
			description:
				"Generated OpenAPI document from inferred TypeScript endpoint types.",
		},
		servers: [{ url: `http://${env.hostname}:${env.port}` }],
		paths,
	};
}

export function createRuntime(appModule: AppModule) {
	const routes = appModule.endpoints.map((endpoint) => {
		const compiled = compilePath(endpoint.path);

		return {
			endpoint,
			pathPattern: compiled.pathPattern,
			pathKeys: compiled.pathKeys,
		};
	});

	return {
		port: env.port,
		hostname: env.hostname,
		fetch: async (request: Request): Promise<Response> => {
			const requestId =
				request.headers.get("x-request-id") ?? crypto.randomUUID();
			const url = new URL(request.url);
			const origin = request.headers.get("origin");

			const user = await authenticateRequest(request);
			const responseHeaders = new Headers();

			return requestStorage.run(
				{ request, requestId, user, responseHeaders },
				async () => {
					if (appModule.rawFetch) {
						const rawResponse = await appModule.rawFetch(request);
						if (rawResponse) {
							for (const [key, value] of responseHeaders.entries()) {
								rawResponse.headers.append(key, value);
							}
							return rawResponse;
						}
					}

					if (request.method === "OPTIONS") {
						return new Response(null, {
							status: 204,
							headers: createHeaders(requestId, origin),
						});
					}

					if (url.pathname === "/") {
						return createRootResponse(requestId, origin);
					}

					if (url.pathname === "/openapi.json") {
						return createOpenApiResponse(
							requestId,
							createOpenApiDocument(appModule.endpoints),
							request,
							origin,
						);
					}

					const matchingRoutes = routes.filter((route) =>
						route.pathPattern.test(url.pathname),
					);

					if (matchingRoutes.length === 0) {
						return json(
							requestId,
							404,
							createErrorEnvelope(
								requestId,
								new ApiError(404, "NOT_FOUND", "Route not found", {
									method: request.method,
									path: url.pathname,
								}),
							),
							origin,
						);
					}

					const methodMatch = matchingRoutes.find(
						(route) => route.endpoint.method === request.method.toUpperCase(),
					);

					if (!methodMatch) {
						const allow = matchingRoutes
							.map((route) => route.endpoint.method)
							.sort()
							.join(", ");
						const response = json(
							requestId,
							405,
							createErrorEnvelope(
								requestId,
								new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed", {
									allow,
								}),
							),
							origin,
						);
						response.headers.set("allow", allow);
						return response;
					}

					try {
						return await executeEndpoint(methodMatch, {
							request,
							requestId,
						});
					} catch (error) {
						const apiError = isApiError(error)
							? error
							: new ApiError(
									500,
									"INTERNAL_SERVER_ERROR",
									"Unexpected server error",
								);

						if (!isApiError(error)) {
							console.error("Unhandled request failure", error);
						}

						const response = json(
							requestId,
							apiError.status,
							createErrorEnvelope(requestId, apiError),
							origin,
						);

						for (const [key, value] of responseHeaders.entries()) {
							response.headers.append(key, value);
						}

						return response;
					}
				},
			);
		},
		error(error: unknown) {
			const requestId = crypto.randomUUID();
			const apiError = isApiError(error)
				? error
				: new ApiError(500, "SERVER_BOOT_ERROR", "Server boot failure");

			return json(
				requestId,
				apiError.status,
				createErrorEnvelope(requestId, apiError),
			);
		},
	};
}
