/**
 * Validated, typed environment configuration.
 *
 * Every variable is read once, validated, and exposed through `env`. Invalid or
 * missing configuration fails fast with a readable list of problems instead of
 * surfacing as a confusing runtime error later.
 *
 * The object is resolved lazily so the same module works on Bun (where
 * `process.env` is available immediately) and on Cloudflare Workers (where
 * bindings are handed to the `fetch` handler and seeded via `configureEnv`).
 */

export type AppEnvironment = "development" | "test" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export type CookieSameSite = "lax" | "strict" | "none";
export type DatabaseDriver = "postgres" | "neon";

export type Env = {
	readonly appName: string;
	readonly appEnv: AppEnvironment;
	readonly isProduction: boolean;
	readonly apiVersion: string;
	readonly hostname: string;
	readonly port: number;
	/** Public URL of this API (no trailing slash). */
	readonly apiUrl: string;
	/** Public URL of the web frontend (no trailing slash). */
	readonly webUrl: string;
	/** Origins allowed to call the API with credentials. Supports `*` wildcards in hostnames. */
	readonly corsOrigins: readonly string[];
	readonly sessionTtlMs: number;
	readonly cookieSameSite: CookieSameSite;
	readonly cookieDomain: string | undefined;
	readonly cookieSecure: boolean;
	readonly databaseUrl: string | undefined;
	readonly databaseDriver: DatabaseDriver;
	readonly google: {
		readonly clientId: string | undefined;
		readonly clientSecret: string | undefined;
		readonly callbackUrl: string;
	};
	readonly logLevel: LogLevel;
	readonly logFormat: "pretty" | "json";
	readonly debugApi: boolean;
	readonly validateResponses: boolean;
	readonly maxBodyBytes: number;
};

type Source = Record<string, string | undefined>;

class EnvError extends Error {
	constructor(problems: string[]) {
		super(
			`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}\n\nSee engine/.env.example for the full list of variables.`,
		);
		this.name = "EnvError";
	}
}

function createReader(source: Source) {
	const problems: string[] = [];

	const raw = (name: string): string | undefined => {
		const value = source[name];
		if (value === undefined) return undefined;
		const trimmed = value.trim();
		return trimmed === "" ? undefined : trimmed;
	};

	return {
		problems,
		string(name: string, fallback: string): string {
			return raw(name) ?? fallback;
		},
		optional(name: string): string | undefined {
			return raw(name);
		},
		int(name: string, fallback: number, { min = 0 } = {}): number {
			const value = raw(name);
			if (value === undefined) return fallback;
			const parsed = Number.parseInt(value, 10);
			if (!Number.isInteger(parsed) || parsed < min) {
				problems.push(`${name} must be an integer >= ${min} (got "${value}")`);
				return fallback;
			}
			return parsed;
		},
		bool(name: string, fallback: boolean): boolean {
			const value = raw(name);
			if (value === undefined) return fallback;
			if (value === "true" || value === "1") return true;
			if (value === "false" || value === "0") return false;
			problems.push(`${name} must be "true" or "false" (got "${value}")`);
			return fallback;
		},
		oneOf<const T extends readonly string[]>(
			name: string,
			values: T,
			fallback: T[number],
		): T[number] {
			const value = raw(name);
			if (value === undefined) return fallback;
			if (values.includes(value)) return value as T[number];
			problems.push(
				`${name} must be one of ${values.join(", ")} (got "${value}")`,
			);
			return fallback;
		},
		url(name: string, fallback: string): string {
			const value = raw(name) ?? fallback;
			try {
				const parsed = new URL(value);
				return parsed.origin + parsed.pathname.replace(/\/+$/, "");
			} catch {
				problems.push(`${name} must be an absolute URL (got "${value}")`);
				return fallback;
			}
		},
		list(name: string, fallback: readonly string[]): string[] {
			const value = raw(name);
			if (value === undefined) return [...fallback];
			return value
				.split(",")
				.map((entry) => entry.trim().replace(/\/+$/, ""))
				.filter((entry) => entry.length > 0);
		},
	};
}

export function parseEnv(source: Source): Env {
	const read = createReader(source);

	const appEnv = read.oneOf(
		"NODE_ENV",
		["development", "test", "production"] as const,
		"development",
	);
	const isProduction = appEnv === "production";
	const port = read.int("PORT", 3000, { min: 1 });
	const apiUrl = read.url("API_URL", `http://localhost:${port}`);
	const webUrl = read.url("WEB_URL", "http://localhost:5173");
	const corsOrigins = read.list("CORS_ORIGINS", [webUrl]);
	const legacyCorsOrigin = read.optional("CORS_ORIGIN");
	if (legacyCorsOrigin && !source.CORS_ORIGINS) {
		// Backwards compatibility with the previous single-origin variable.
		corsOrigins.splice(0, corsOrigins.length, ...legacyCorsOrigin.split(","));
	}

	const cookieSameSite = read.oneOf(
		"COOKIE_SAME_SITE",
		["lax", "strict", "none"] as const,
		"lax",
	);
	const cookieSecure = read.bool(
		"COOKIE_SECURE",
		isProduction || cookieSameSite === "none" || apiUrl.startsWith("https://"),
	);

	if (cookieSameSite === "none" && !cookieSecure) {
		read.problems.push(
			'COOKIE_SAME_SITE="none" requires COOKIE_SECURE="true" (browsers reject SameSite=None cookies without Secure)',
		);
	}

	if (isProduction && corsOrigins.includes("*")) {
		read.problems.push(
			'CORS_ORIGINS must not contain "*" in production: the API uses cookie authentication and browsers forbid wildcard origins with credentials',
		);
	}

	const databaseUrl = read.optional("DATABASE_URL");
	const explicitDriver = read.optional("DATABASE_DRIVER");
	const databaseDriver = read.oneOf(
		"DATABASE_DRIVER",
		["postgres", "neon"] as const,
		detectDatabaseDriver(databaseUrl),
	);
	if (
		explicitDriver === undefined &&
		databaseUrl === undefined &&
		isProduction
	) {
		read.problems.push("DATABASE_URL is required in production");
	}

	const googleClientId = read.optional("GOOGLE_CLIENT_ID");
	const googleClientSecret = read.optional("GOOGLE_CLIENT_SECRET");
	if ((googleClientId === undefined) !== (googleClientSecret === undefined)) {
		read.problems.push(
			"GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
		);
	}

	const env: Env = {
		appName: read.string("APP_NAME", "starterkit-engine"),
		appEnv,
		isProduction,
		apiVersion: "v1",
		hostname: read.string("HOST", "0.0.0.0"),
		port,
		apiUrl,
		webUrl,
		corsOrigins,
		sessionTtlMs:
			read.int("SESSION_TTL_DAYS", 7, { min: 1 }) * 24 * 60 * 60 * 1000,
		cookieSameSite,
		cookieDomain: read.optional("COOKIE_DOMAIN"),
		cookieSecure,
		databaseUrl,
		databaseDriver,
		google: {
			clientId: googleClientId,
			clientSecret: googleClientSecret,
			callbackUrl: read.url(
				"GOOGLE_CALLBACK_URL",
				`${apiUrl}/api/auth/google/callback`,
			),
		},
		logLevel: read.oneOf(
			"LOG_LEVEL",
			["debug", "info", "warn", "error", "silent"] as const,
			isProduction ? "info" : "debug",
		),
		logFormat: read.oneOf(
			"LOG_FORMAT",
			["pretty", "json"] as const,
			isProduction ? "json" : "pretty",
		),
		debugApi: read.bool("DEBUG_API", false),
		validateResponses: read.bool("VALIDATE_RESPONSES", true),
		maxBodyBytes: read.int("MAX_BODY_BYTES", 1024 * 1024, { min: 1024 }),
	};

	if (read.problems.length > 0) {
		throw new EnvError(read.problems);
	}

	return env;
}

function detectDatabaseDriver(databaseUrl: string | undefined): DatabaseDriver {
	if (!databaseUrl) return "postgres";
	try {
		const host = new URL(databaseUrl).hostname;
		return host.endsWith(".neon.tech") ? "neon" : "postgres";
	} catch {
		return "postgres";
	}
}

let cached: Env | undefined;
let pendingSource: Source | undefined;

/**
 * Seed the environment from an explicit source (e.g. Cloudflare Worker
 * bindings). Safe to call on every request: it is a no-op once configured
 * with the same object.
 */
export function configureEnv(source: Source): void {
	if (pendingSource === source) return;
	pendingSource = source;
	cached = undefined;
}

/** Reset the cached environment (tests only). */
export function resetEnv(): void {
	cached = undefined;
	pendingSource = undefined;
}

export function getEnv(): Env {
	if (!cached) {
		const base: Source =
			typeof process !== "undefined" && process.env ? process.env : {};
		cached = parseEnv(pendingSource ? { ...base, ...pendingSource } : base);
	}
	return cached;
}

/**
 * Lazily-resolved environment. Reads happen on first property access so the
 * module can be imported at the top level on every runtime.
 */
export const env: Env = new Proxy({} as Env, {
	get(_target, property) {
		return getEnv()[property as keyof Env];
	},
	ownKeys() {
		return Reflect.ownKeys(getEnv());
	},
	getOwnPropertyDescriptor(_target, property) {
		return Object.getOwnPropertyDescriptor(getEnv(), property);
	},
});
