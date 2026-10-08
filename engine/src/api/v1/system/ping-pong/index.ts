/** Echo endpoint used by the home page to demonstrate typed GET queries. */
export function getPingPong(input?: { message?: string; repeat?: number }) {
	const message = input?.message?.trim() || "ping";
	const repeatCount = Math.max(1, Math.min(input?.repeat ?? 1, 5));

	return {
		received: message,
		reply: "pong",
		exchange: `${message}:pong`,
		repeated: Array.from({ length: repeatCount }, () => "pong"),
		timestamp: new Date().toISOString(),
	};
}
