import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import {
	drizzle as drizzlePostgres,
	type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import { logger } from "../core/logger";
import * as schema from "./schema";

/**
 * Two drivers are supported and chosen from `DATABASE_URL` / `DATABASE_DRIVER`:
 *
 * - `neon`     — HTTP driver. Required on Cloudflare Workers, works everywhere.
 * - `postgres` — postgres.js over TCP. Best for Bun with any Postgres
 *                (Docker, RDS, Supabase, Railway, ...).
 *
 * Both expose the same drizzle API, so endpoint code never cares which is used.
 */
/**
 * Both drivers expose the same query builder. The handle is typed against the
 * postgres.js flavour so endpoint code gets one concrete type regardless of
 * the driver chosen at runtime.
 */
export type Database = PostgresJsDatabase<typeof schema>;

let instance: Database | undefined;

function createDatabase(): Database {
	const url = env.databaseUrl;
	if (!url) {
		throw new Error(
			"DATABASE_URL is not set. Add it to engine/.env (see engine/.env.example).",
		);
	}

	if (env.databaseDriver === "neon") {
		logger.debug("database: using neon-http driver");
		return drizzleNeon({ client: neon(url), schema }) as unknown as Database;
	}

	logger.debug("database: using postgres.js driver");
	const client = postgres(url, {
		max: 10,
		idle_timeout: 20,
		connect_timeout: 10,
		// Transaction-mode poolers (pgbouncer, Supabase "transaction" pooling)
		// do not support prepared statements.
		prepare: !/pgbouncer=true|pooler\./i.test(url),
		onnotice: () => {},
	});
	return drizzlePostgres({ client, schema });
}

export function getDb(): Database {
	if (!instance) instance = createDatabase();
	return instance;
}

/**
 * Lazily-initialised database handle. Importing this module never opens a
 * connection; the first query does. This keeps `make generate`, tests and the
 * OpenAPI build working without a database.
 */
export const db: Database = new Proxy({} as Database, {
	get(_target, property) {
		const target = getDb() as unknown as Record<PropertyKey, unknown>;
		const value = target[property];
		return typeof value === "function" ? value.bind(target) : value;
	},
});

export { schema };
