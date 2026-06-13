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
}
