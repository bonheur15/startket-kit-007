export function getPingPong(input?: { message?: string; repeat?: number }) {
	const message = input?.message?.trim() || "ping";
	const repeatCount = Math.max(1, Math.min(input?.repeat ?? 1, 5));
	const repeated = Array.from({ length: repeatCount }, () => "pong");

	return {
		received: message,
		reply: "pong",
		exchange: `${message}:pong`,
		repeated,
		timestamp: new Date().toISOString(),
	};
}
