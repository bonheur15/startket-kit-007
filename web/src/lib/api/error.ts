export class ApiClientError<TDetails = unknown> extends Error {
	readonly status: number;
	readonly code: string;
	readonly details?: TDetails;
	readonly requestId?: string;

	constructor(input: {
		status: number;
		code: string;
		message: string;
		details?: TDetails;
		requestId?: string;
	}) {
		super(input.message);
		this.name = "ApiClientError";
		this.status = input.status;
		this.code = input.code;
		this.details = input.details;
		this.requestId = input.requestId;
	}

	get isUnauthorized() {
		return this.status === 401;
	}

	get isNotFound() {
		return this.status === 404;
	}

	get isValidation() {
		return this.status === 400 && this.code === "BAD_REQUEST";
	}

	/** Validation issues reported by the engine (`$.input.title: expected string`). */
	get issues(): string[] {
		const details = this.details as { issues?: unknown } | undefined;
		return Array.isArray(details?.issues) ? (details.issues as string[]) : [];
	}
}

export function isApiClientError(error: unknown): error is ApiClientError {
	return error instanceof ApiClientError;
}
