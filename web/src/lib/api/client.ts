import { API_BASE_URL } from "./config";
import { ApiClientError } from "./error";

export type EndpointMeta = {
	operationId: string;
	method: string;
	path: string;
};

type SuccessEnvelope<TData> = {
	ok: true;
	data: TData;
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

function appendQuery(
	url: URL,
	query: Record<string, unknown> | undefined,
): void {
	if (!query) {
		return;
	}

	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null) {
			continue;
		}

		if (Array.isArray(value)) {
			for (const entry of value) {
				url.searchParams.append(key, String(entry));
			}
			continue;
		}

		url.searchParams.set(key, String(value));
	}
}

export function createRequestUrl(
	path: string,
	query?: Record<string, unknown>,
) {
	const url = new URL(path, API_BASE_URL);
	appendQuery(url, query);
	return url;
}

export async function apiRequest<TResponse, TInput = undefined>(
	endpoint: EndpointMeta,
	input?: TInput,
	options?: { debug?: boolean },
): Promise<TResponse> {
	const method = endpoint.method.toUpperCase();
	const isBodyMethod =
		method === "POST" || method === "PUT" || method === "PATCH";

	const inputRecord = (input ?? {}) as Record<string, unknown>;
	const queryPayload = inputRecord.query as Record<string, unknown> | undefined;
	const bodyPayload = inputRecord.body;

	const url = createRequestUrl(endpoint.path, queryPayload);

	const headers: Record<string, string> = {
		...(isBodyMethod && bodyPayload !== undefined
			? { "content-type": "application/json" }
			: {}),
		...(options?.debug ? { "x-debug": "true" } : {}),
	};

	const response = await fetch(url, {
		method,
		headers: Object.keys(headers).length > 0 ? headers : undefined,
		body:
			isBodyMethod && bodyPayload !== undefined
				? JSON.stringify(bodyPayload)
				: undefined,
		credentials: "include",
	});

	const payload = (await response.json()) as
		| SuccessEnvelope<TResponse>
		| ErrorEnvelope;

	if (!response.ok || !payload.ok) {
		const errorPayload = payload as ErrorEnvelope;

		throw new ApiClientError({
			status: response.status,
			code: errorPayload.error?.code ?? "REQUEST_FAILED",
			message: errorPayload.error?.message ?? "Request failed",
			details: errorPayload.error?.details,
			requestId: errorPayload.meta?.requestId,
		});
	}

	return payload.data;
}
