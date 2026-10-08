import type { RequestContext } from "./context";

export type RawMethod =
	| "GET"
	| "POST"
	| "PUT"
	| "PATCH"
	| "DELETE"
	| "OPTIONS"
	| "HEAD";

/**
 * A raw route bypasses the function-first RPC layer. Use it for things that
 * cannot be modelled as a JSON function call: OAuth redirects, webhooks,
 * multipart uploads, streaming responses, websockets.
 *
 * Raw routes still get the request context (request id, lazy user, logger),
 * CORS headers, and error envelopes for thrown `ApiError`s.
 */
export type RawRoute = {
	method: RawMethod;
	/** Exact pathname (e.g. "/api/auth/google/login"). Use `pattern` for params. */
	path?: string;
	/** Path pattern with `:param` segments (e.g. "/api/webhooks/:provider"). */
	pattern?: string;
	handler: (
		context: RequestContext,
		params: Record<string, string>,
	) => Response | Promise<Response>;
};

export function defineRawRoutes<const T extends readonly RawRoute[]>(
	routes: T,
): T {
	return routes;
}
