import { env } from "../../config/env";
import type { User } from "../../db/schema";
import { getSessionTokenFromRequest, validateSession } from "../auth/sessions";
import { applyCorsHeaders } from "../http/cors";
import { logger as rootLogger } from "../logger";
import { SchemaError } from "../schema";
import { type RequestContext, requestStorage } from "./context";
import { ApiError, isApiError } from "./error";
import { createOpenApiDocument } from "./openapi";
import type { RawRoute } from "./raw";
import type { EndpointModule, ErrorEnvelope, SuccessEnvelope } from "./types";

export { requestStorage } from "./context";
export { createOpenApiDocument } from "./openapi";
export type { EndpointModule } from "./types";

export type AppModule = {
	endpoints: readonly EndpointModule[];
	/** Explicit non-RPC routes (OAuth, webhooks, uploads). Matched before RPC routes. */
	rawRoutes?: readonly RawRoute[];
	/**
	 * Last-resort escape hatch. Return a `Response` to short-circuit, or
	 * `undefined` to continue to raw routes and RPC routes.
	 */
	rawFetch?: (
		request: Request,
	) => Response | Promise<Response | undefined> | undefined;
	/** Called for every unexpected (non-ApiError) failure. Hook error reporting here. */
	onError?: (error: unknown, context: RequestContext) => void;
};

type CompiledPath = { pattern: RegExp; keys: string[] };

type RpcRoute = {
	kind: "rpc";
	endpoint: EndpointModule;
	compiled: CompiledPath;
};
type RawCompiledRoute = {
	kind: "raw";
	route: RawRoute;
	compiled: CompiledPath;
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const SECURITY_HEADERS: Record<string, string> = {
	"x-content-type-options": "nosniff",
	"referrer-policy": "no-referrer",
	"cache-control": "no-store",
};

function compilePath(path: string): CompiledPath {
	const keys: string[] = [];
	const escaped = path
		.split("/")
		.map((segment) => {
			if (segment.startsWith(":")) {
				keys.push(segment.slice(1));
				return "([^/]+)";
			}
			return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		})
		.join("/");
	return { pattern: new RegExp(`^${escaped}$`), keys };
}

function matchPath(
	compiled: CompiledPath,
	pathname: string,
): Record<string, string> | null {
	const match = compiled.pattern.exec(pathname);
	if (!match) return null;
	const params: Record<string, string> = {};
	compiled.keys.forEach((key, index) => {
		const value = match[index + 1] ?? "";
		try {
			params[key] = decodeURIComponent(value);
		} catch {
			params[key] = value;
		}
	});
	return params;
}

function normalizePathname(pathname: string): string {
	if (pathname.length > 1 && pathname.endsWith("/"))
		return pathname.replace(/\/+$/, "");
	return pathname;
}

function resolveRequestId(request: Request): string {
	const provided = request.headers.get("x-request-id");
	return provided && REQUEST_ID_PATTERN.test(provided)
		? provided
		: crypto.randomUUID();
}

function baseHeaders(context: RequestContext): Headers {
	const headers = new Headers();
	headers.set("content-type", "application/json; charset=utf-8");
	headers.set("x-request-id", context.requestId);
	for (const [name, value] of Object.entries(SECURITY_HEADERS))
		headers.set(name, value);
	applyCorsHeaders(headers, context.request.headers.get("origin"));
	return headers;
}

function jsonResponse(
	context: RequestContext,
	status: number,
	body: unknown,
): Response {
	const response = Response.json(body, {
		status,
		headers: baseHeaders(context),
	});
	for (const [name, value] of context.responseHeaders)
		response.headers.append(name, value);
	return response;
}

function successEnvelope<T>(
	context: RequestContext,
	data: T,
): SuccessEnvelope<T> {
	return {
		ok: true,
		data,
		meta: { requestId: context.requestId, timestamp: new Date().toISOString() },
	};
}

function errorEnvelope(
	context: RequestContext,
	error: ApiError,
): ErrorEnvelope {
	return {
		ok: false,
		error: { code: error.code, message: error.message, details: error.details },
		meta: { requestId: context.requestId, timestamp: new Date().toISOString() },
	};
}

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

async function readJsonBody(request: Request): Promise<unknown> {
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.toLowerCase().includes("application/json")) {
		throw new ApiError(
			415,
			"UNSUPPORTED_MEDIA_TYPE",
			"Expected an application/json body",
		);
	}

	const declared = Number(request.headers.get("content-length") ?? "0");
	if (declared > env.maxBodyBytes) {
		throw new ApiError(
			413,
			"PAYLOAD_TOO_LARGE",
			`Body exceeds ${env.maxBodyBytes} bytes`,
		);
	}

	const text = await readTextWithLimit(request, env.maxBodyBytes);
	if (text.trim() === "") return undefined;

	try {
		return JSON.parse(text);
	} catch {
		throw new ApiError(
			400,
			"INVALID_JSON",
			"Request body must contain valid JSON",
		);
	}
}

async function readTextWithLimit(
	request: Request,
	limit: number,
): Promise<string> {
	if (!request.body) return "";
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		received += value.byteLength;
		if (received > limit) {
			await reader.cancel();
			throw new ApiError(
				413,
				"PAYLOAD_TOO_LARGE",
				`Body exceeds ${limit} bytes`,
			);
		}
		chunks.push(value);
	}
	const merged = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(merged);
}

function looksBodyless(request: Request): boolean {
	const length = request.headers.get("content-length");
	return (
		(length === null || length === "0") && !request.headers.get("content-type")
	);
}

function mergeInput(
	endpoint: EndpointModule,
	params: Record<string, string>,
	query: Record<string, unknown>,
	body: unknown,
): unknown {
	if (endpoint.inputSource === "none") return undefined;
	if (endpoint.inputSource === "query") return { ...params, ...query };
	const bodyRecord =
		typeof body === "object" && body !== null && !Array.isArray(body)
			? (body as Record<string, unknown>)
			: {};
	return { ...params, ...bodyRecord };
}

async function executeRpc(
	route: RpcRoute,
	context: RequestContext,
	params: Record<string, string>,
): Promise<Response> {
	const { endpoint } = route;
	const query = normalizeQuery(context.url.searchParams);
	const body =
		endpoint.inputSource === "body"
			? endpoint.inputOptional && looksBodyless(context.request)
				? undefined
				: await readJsonBody(context.request)
			: undefined;

	const rawInput = mergeInput(endpoint, params, query, body);

	let parsedInput: unknown;
	try {
		parsedInput = endpoint.inputSchema
			? endpoint.inputSchema.parse(rawInput, "$.input")
			: undefined;
	} catch (error) {
		if (error instanceof SchemaError) {
			context.logger.debug("validation failed", {
				issues: error.issues,
				input: rawInput,
			});
			throw new ApiError(400, "BAD_REQUEST", "Validation failed", {
				issues: error.issues,
			});
		}
		throw error;
	}

	const data =
		parsedInput === undefined
			? await endpoint.handler()
			: await endpoint.handler(parsedInput);

	if (env.validateResponses) {
		try {
			endpoint.responseSchema.parse(data, "$.response");
		} catch (error) {
			if (error instanceof SchemaError) {
				context.logger.error("response validation failed", {
					operationId: endpoint.operationId,
					issues: error.issues,
				});
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
	}

	if (env.debugApi || context.request.headers.get("x-debug") === "true") {
		context.logger.debug("rpc", {
			operationId: endpoint.operationId,
			params,
			query,
			body,
			output: data,
		});
	}

	return jsonResponse(context, 200, successEnvelope(context, data));
}

function createRootResponse(context: RequestContext): Response {
	return jsonResponse(
		context,
		200,
		successEnvelope(context, {
			service: env.appName,
			environment: env.appEnv,
			apiVersion: env.apiVersion,
			docs: "/openapi.json",
		}),
	);
}

export function createRuntime(appModule: AppModule) {
	const rpcRoutes: RpcRoute[] = appModule.endpoints.map((endpoint) => ({
		kind: "rpc",
		endpoint,
		compiled: compilePath(endpoint.path),
	}));
	const rawRoutes: RawCompiledRoute[] = (appModule.rawRoutes ?? []).map(
		(route) => {
			const path = route.pattern ?? route.path;
			if (!path) throw new Error("Raw routes need either `path` or `pattern`.");
			return { kind: "raw", route, compiled: compilePath(path) };
		},
	);

	const seen = new Set<string>();
	for (const route of rpcRoutes) {
		const key = `${route.endpoint.method} ${route.endpoint.path}`;
		if (seen.has(key)) throw new Error(`Duplicate endpoint registered: ${key}`);
		seen.add(key);
	}

	let openApiDocument: ReturnType<typeof createOpenApiDocument> | undefined;
	const getOpenApiDocument = () => {
		openApiDocument ??= createOpenApiDocument(appModule.endpoints);
		return openApiDocument;
	};

	async function dispatch(context: RequestContext): Promise<Response> {
		const { request, url } = context;
		const method = request.method.toUpperCase();
		const pathname = normalizePathname(url.pathname);

		if (appModule.rawFetch) {
			const response = await appModule.rawFetch(request);
			if (response) return response;
		}

		for (const raw of rawRoutes) {
			if (raw.route.method !== method) continue;
			const params = matchPath(raw.compiled, pathname);
			if (params) return raw.route.handler(context, params);
		}

		if (method === "OPTIONS") {
			return new Response(null, { status: 204, headers: baseHeaders(context) });
		}

		if (pathname === "/") return createRootResponse(context);

		if (pathname === "/openapi.json") {
			return jsonResponse(context, 200, {
				...getOpenApiDocument(),
				servers: [{ url: url.origin }],
			});
		}

		const effectiveMethod = method === "HEAD" ? "GET" : method;
		let matchedPath = false;
		const allowed: string[] = [];

		for (const route of rpcRoutes) {
			const params = matchPath(route.compiled, pathname);
			if (!params) continue;
			matchedPath = true;
			allowed.push(route.endpoint.method);
			if (route.endpoint.method !== effectiveMethod) continue;

			const response = await executeRpc(route, context, params);
			return method === "HEAD"
				? new Response(null, {
						status: response.status,
						headers: response.headers,
					})
				: response;
		}

		if (matchedPath) {
			const allow = allowed.sort().join(", ");
			const response = jsonResponse(
				context,
				405,
				errorEnvelope(
					context,
					new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed", {
						allow,
					}),
				),
			);
			response.headers.set("allow", allow);
			return response;
		}

		throw new ApiError(404, "NOT_FOUND", "Route not found", {
			method,
			path: pathname,
		});
	}

	async function handle(request: Request): Promise<Response> {
		const requestId = resolveRequestId(request);
		const url = new URL(request.url);
		const logger = rootLogger.child({ requestId });
		const startedAt = performance.now();

		let userPromise: Promise<User | null> | undefined;
		const context: RequestContext = {
			request,
			url,
			requestId,
			startedAt,
			logger,
			responseHeaders: new Headers(),
			user: () => {
				userPromise ??= (async () => {
					const token = getSessionTokenFromRequest(request);
					if (!token) return null;
					try {
						const session = await validateSession(token);
						return session?.user ?? null;
					} catch (error) {
						logger.error("session lookup failed", { error });
						return null;
					}
				})();
				return userPromise;
			},
		};

		const response = await requestStorage.run(context, async () => {
			try {
				return await dispatch(context);
			} catch (error) {
				const apiError = isApiError(error)
					? error
					: new ApiError(
							500,
							"INTERNAL_SERVER_ERROR",
							"Unexpected server error",
						);

				if (!isApiError(error)) {
					logger.error("unhandled request failure", { error });
					appModule.onError?.(error, context);
				}

				return jsonResponse(
					context,
					apiError.status,
					errorEnvelope(context, apiError),
				);
			}
		});

		const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
		const level =
			response.status >= 500
				? "error"
				: response.status >= 400
					? "warn"
					: "info";
		logger[level](`${request.method} ${url.pathname} -> ${response.status}`, {
			method: request.method,
			path: url.pathname,
			status: response.status,
			durationMs,
		});

		return response;
	}

	return {
		port: env.port,
		hostname: env.hostname,
		fetch: handle,
		/** Build the OpenAPI document for these endpoints (used by the generator). */
		openapi: getOpenApiDocument,
		error(error: unknown): Response {
			rootLogger.error("server error", { error });
			const apiError = isApiError(error)
				? error
				: new ApiError(500, "INTERNAL_SERVER_ERROR", "Unexpected server error");
			return Response.json(
				{
					ok: false,
					error: { code: apiError.code, message: apiError.message },
					meta: {
						requestId: crypto.randomUUID(),
						timestamp: new Date().toISOString(),
					},
				},
				{
					status: apiError.status,
					headers: { "content-type": "application/json" },
				},
			);
		},
	};
}

export type Runtime = ReturnType<typeof createRuntime>;
