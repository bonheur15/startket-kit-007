/**
 * Bun entry point. Cloudflare Workers use `src/worker.ts` instead.
 *
 * Note: this file intentionally has no default export. Bun auto-serves a
 * default export that looks like a server config, which would start a second
 * server on the same port.
 */
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./core/logger";

const app = createApp();

const server = Bun.serve({
	port: env.port,
	hostname: env.hostname,
	development: !env.isProduction,
	maxRequestBodySize: env.maxBodyBytes * 4,
	fetch: app.fetch,
	error: app.error,
});

logger.info(
	`${env.appName} listening on http://${server.hostname}:${server.port}`,
	{
		environment: env.appEnv,
		docs: `${env.apiUrl}/openapi.json`,
	},
);

function shutdown(signal: string) {
	logger.info(`received ${signal}, shutting down`);
	server.stop(true);
	process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
