/**
 * Error raised from endpoint code to produce a structured HTTP error response.
 * Anything else thrown from a handler is treated as an unexpected 500 and its
 * message is never exposed to clients.
 */
export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details?: unknown;

	constructor(
		status: number,
		code: string,
		message: string,
		details?: unknown,
	) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}

/** Convenience constructors for the most common failures. */
export const errors = {
	badRequest: (message = "Bad request", details?: unknown) =>
		new ApiError(400, "BAD_REQUEST", message, details),
	unauthorized: (message = "Authentication required") =>
		new ApiError(401, "UNAUTHORIZED", message),
	forbidden: (message = "You do not have access to this resource") =>
		new ApiError(403, "FORBIDDEN", message),
	notFound: (message = "Resource not found") =>
		new ApiError(404, "NOT_FOUND", message),
	conflict: (message = "Conflict", details?: unknown) =>
		new ApiError(409, "CONFLICT", message, details),
	tooManyRequests: (message = "Too many requests") =>
		new ApiError(429, "TOO_MANY_REQUESTS", message),
	internal: (message = "Unexpected server error") =>
		new ApiError(500, "INTERNAL_SERVER_ERROR", message),
};
