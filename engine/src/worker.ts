/**
 * Cloudflare Workers entry point (see wrangler.toml).
 *
 * Worker bindings (vars + secrets) are passed to `fetch`, so the environment
 * is seeded from them before the app is created.
 */
import { createApp } from "./app";
import { configureEnv } from "./config/env";
import { cleanExpiredSessions } from "./core/auth/sessions";
import { logger } from "./core/logger";

type Bindings = Record<string, string | undefined>;
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };

let app: ReturnType<typeof createApp> | undefined;

export default {
	async fetch(request: Request, bindings: Bindings): Promise<Response> {
		configureEnv(bindings);
		app ??= createApp();
		return app.fetch(request);
	},

	/** Runs on the cron schedule configured in wrangler.toml (`[triggers]`). */
	async scheduled(
		_event: unknown,
		bindings: Bindings,
		ctx: ExecutionContext,
	): Promise<void> {
		configureEnv(bindings);
		ctx.waitUntil(
			cleanExpiredSessions().catch((error) => {
				logger.error("failed to clean expired sessions", { error });
			}),
		);
	},
};
