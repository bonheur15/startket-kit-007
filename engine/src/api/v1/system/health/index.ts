import { env } from "../../../../config/env";

const startedAt = Date.now();

/**
 * Liveness check.
 * Pass `verbose=true` to include runtime details.
 */
export function getSystemHealth(input?: { verbose?: boolean }) {
	return {
		service: env.appName,
		environment: env.appEnv,
		version: env.apiVersion,
		status: "healthy" as const,
		uptimeMs: Date.now() - startedAt,
		timestamp: new Date().toISOString(),
		checks: input?.verbose
			? {
					runtime: (typeof Bun !== "undefined"
						? "bun"
						: "cloudflare-workers") as "bun" | "cloudflare-workers",
					docs: "/openapi.json",
				}
			: undefined,
	};
}
