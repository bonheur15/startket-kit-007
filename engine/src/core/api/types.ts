import type { Schema } from "../schema";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type InputSource = "none" | "query" | "body";

/**
 * Shape of one generated endpoint entry (see `.generated/endpoints.ts`).
 * The generator infers everything here from the exported function signature.
 */
export type EndpointModule = {
	operationId: string;
	method: HttpMethod;
	path: string;
	inputSource: InputSource;
	inputOptional?: boolean;
	pathParamNames: readonly string[];
	inputSchema?: Schema<unknown>;
	responseSchema: Schema<unknown>;
	/** First line of the JSDoc comment on the endpoint function. */
	summary?: string;
	/** Remaining JSDoc text. */
	description?: string;
	/** OpenAPI tags; defaults to the first path segment after the version. */
	tags?: readonly string[];
	/** True when the handler calls `requireAuth()`. */
	auth?: boolean;
	deprecated?: boolean;
	// biome-ignore lint/suspicious/noExplicitAny: contravariance boundary for handler types
	handler: (input?: any) => unknown | Promise<unknown>;
};

export type SuccessEnvelope<T> = {
	ok: true;
	data: T;
	meta: {
		requestId: string;
		timestamp: string;
	};
};

export type ErrorEnvelope = {
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
