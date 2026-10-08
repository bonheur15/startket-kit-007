import { API_BASE_URL } from "./config";
import { ApiClientError } from "./error";

export type EndpointMeta = {
	operationId: string;
	method: string;
	path: string;
	inputSource?: "none" | "query" | "body";
	auth?: boolean;
};

/** Wire format for inputs: query-string params for GET/DELETE, JSON body otherwise. */
export type EndpointInput = {
	query?: Record<string, unknown>;
	body?: unknown;
};

export type RequestOptions = {
	/** Ask the engine to log this call in detail (non-production only). */
	debug?: boolean;
	/** Abort signal (React Query passes one automatically). */
	signal?: AbortSignal;
	/** Fail the request after this many milliseconds. */
	timeoutMs?: number;
	/** Extra headers. */
	headers?: Record<string, string>;
};

type SuccessEnvelope<TData> = {
	ok: true;
	data: TData;
	meta: { requestId: string; timestamp: string };
};

type ErrorEnvelope = {
	ok: false;
	error: { code: string; message: string; details?: unknown };
	meta: { requestId: string; timestamp: string };
};

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

function appendQuery(url: URL, query: Record<string, unknown> | undefined) {
	if (!query) return;
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null) continue;
		if (Array.isArray(value)) {
			for (const entry of value) url.searchParams.append(key, serialize(entry));
		} else {
			url.searchParams.set(key, serialize(value));
		}
	}
}

function serialize(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

/**
 * Replace `:param` segments with values from the input and return the
 * remaining input (path params are not sent twice).
 */
function applyPathParams(
	path: string,
	payload: Record<string, unknown> | undefined,
): { path: string; rest: Record<string, unknown> | undefined } {
	if (!payload || !path.includes(":")) return { path, rest: payload };
	const rest = { ...payload };
	const resolved = path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
		const value = rest[key];
		if (value === undefined || value === null) {
			throw new ApiClientError({
				status: 0,
				code: "MISSING_PATH_PARAM",
				message: `Missing path parameter "${key}" for ${path}`,
			});
		}
		delete rest[key];
		return encodeURIComponent(serialize(value));
	});
	return { path: resolved, rest };
}

export function createRequestUrl(
	path: string,
	query?: Record<string, unknown>,
): URL {
	const url = new URL(`${API_BASE_URL}${path}`);
	appendQuery(url, query);
	return url;
}

async function parseEnvelope<TResponse>(
	response: Response,
): Promise<SuccessEnvelope<TResponse> | ErrorEnvelope | undefined> {
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) return undefined;
	try {
		return (await response.json()) as
			| SuccessEnvelope<TResponse>
			| ErrorEnvelope;
	} catch {
		return undefined;
	}
}

export async function apiRequest<TResponse>(
	endpoint: EndpointMeta,
	input?: EndpointInput,
	options: RequestOptions = {},
): Promise<TResponse> {
	const method = endpoint.method.toUpperCase();
	const isBodyMethod = BODY_METHODS.has(method);

	const payload = (isBodyMethod ? input?.body : input?.query) as
		| Record<string, unknown>
		| undefined;
	const { path, rest } = applyPathParams(endpoint.path, payload);
	const url = createRequestUrl(path, isBodyMethod ? undefined : rest);

	const headers: Record<string, string> = {
		accept: "application/json",
		...(isBodyMethod && rest !== undefined
			? { "content-type": "application/json" }
			: {}),
		...(options.debug ? { "x-debug": "true" } : {}),
		...options.headers,
	};

	const controller = options.timeoutMs ? new AbortController() : undefined;
	const timeout = controller
		? setTimeout(
				() => controller.abort(new Error("Request timed out")),
				options.timeoutMs,
			)
		: undefined;
	if (controller && options.signal) {
		options.signal.addEventListener(
			"abort",
			() => controller.abort(options.signal?.reason),
			{
				once: true,
			},
		);
	}

	let response: Response;
	try {
		response = await fetch(url, {
			method,
			headers,
			body:
				isBodyMethod && rest !== undefined ? JSON.stringify(rest) : undefined,
			credentials: "include",
			signal: controller?.signal ?? options.signal,
		});
	} catch (error) {
		throw new ApiClientError({
			status: 0,
			code:
				error instanceof Error && error.name === "AbortError"
					? "ABORTED"
					: "NETWORK_ERROR",
			message:
				error instanceof Error && error.message
					? error.message
					: "Could not reach the API. Check your connection and VITE_API_BASE_URL.",
		});
	} finally {
		if (timeout) clearTimeout(timeout);
	}

	const envelope = await parseEnvelope<TResponse>(response);

	if (!response.ok || !envelope?.ok) {
		const failure = envelope && !envelope.ok ? envelope : undefined;
		throw new ApiClientError({
			status: response.status,
			code: failure?.error.code ?? "REQUEST_FAILED",
			message:
				failure?.error.message ??
				`Request failed with status ${response.status}`,
			details: failure?.error.details,
			requestId:
				failure?.meta.requestId ??
				response.headers.get("x-request-id") ??
				undefined,
		});
	}

	return envelope.data;
}
