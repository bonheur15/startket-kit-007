import { AsyncLocalStorage } from "node:async_hooks";
import type { User } from "../../db/schema";
import type { Logger } from "../logger";

/**
 * Per-request state, available anywhere inside an endpoint via
 * `getRequestContext()`. Populated by the runtime before a handler runs.
 */
export type RequestContext = {
	readonly request: Request;
	readonly url: URL;
	readonly requestId: string;
	readonly startedAt: number;
	readonly logger: Logger;
	/** Headers appended to the final response (e.g. Set-Cookie). */
	readonly responseHeaders: Headers;
	/** Lazily resolves the authenticated user (memoized per request). */
	readonly user: () => Promise<User | null>;
};

export const requestStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
	const store = requestStorage.getStore();
	if (!store) {
		throw new Error(
			"No request context: this function must be called while handling a request.",
		);
	}
	return store;
}

/** Append a header to the response that will be sent for the current request. */
export function appendResponseHeader(name: string, value: string): void {
	getRequestContext().responseHeaders.append(name, value);
}

/** Set (replace) a header on the response for the current request. */
export function setResponseHeader(name: string, value: string): void {
	getRequestContext().responseHeaders.set(name, value);
}
