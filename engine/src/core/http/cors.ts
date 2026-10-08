import { env } from "../../config/env";

const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "content-type,authorization,x-request-id,x-debug";
const EXPOSED_HEADERS = "x-request-id";

let compiled: { pattern: RegExp; raw: string }[] | undefined;

function compileOrigins(): { pattern: RegExp; raw: string }[] {
	if (compiled) return compiled;
	compiled = env.corsOrigins.map((raw) => {
		if (raw === "*") return { pattern: /^.*$/, raw };
		const escaped = raw
			.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
			.replace(/\*/g, "[^/]+");
		return { pattern: new RegExp(`^${escaped}$`, "i"), raw };
	});
	return compiled;
}

/** Reset the compiled origin cache (tests only). */
export function resetCorsCache(): void {
	compiled = undefined;
}

/**
 * Returns the origin value to echo back if the request origin is allowed,
 * otherwise `null`. A wildcard entry ("*") allows every origin but, because
 * the API relies on cookies, browsers will still refuse credentialed requests
 * for the echoed wildcard. Prefer explicit origins.
 */
export function resolveAllowedOrigin(
	requestOrigin: string | null,
): string | null {
	if (!requestOrigin) return null;
	for (const { pattern } of compileOrigins()) {
		if (pattern.test(requestOrigin)) return requestOrigin;
	}
	if (!env.isProduction && isLoopbackOrigin(requestOrigin))
		return requestOrigin;
	return null;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Outside production any loopback origin (localhost / 127.0.0.1 / ::1 on any
 * port) is accepted, so the Vite dev server works whichever host you open it
 * on. Production only honours the explicit `CORS_ORIGINS` list.
 */
function isLoopbackOrigin(origin: string): boolean {
	try {
		const url = new URL(origin);
		return (
			(url.protocol === "http:" || url.protocol === "https:") &&
			LOOPBACK_HOSTS.has(url.hostname)
		);
	} catch {
		return false;
	}
}

export function isOriginAllowed(origin: string | null): boolean {
	return resolveAllowedOrigin(origin) !== null;
}

export function applyCorsHeaders(
	headers: Headers,
	requestOrigin: string | null,
): void {
	headers.append("vary", "Origin");
	const allowed = resolveAllowedOrigin(requestOrigin);
	if (!allowed) return;

	headers.set("access-control-allow-origin", allowed);
	headers.set("access-control-allow-credentials", "true");
	headers.set("access-control-allow-methods", ALLOWED_METHODS);
	headers.set("access-control-allow-headers", ALLOWED_HEADERS);
	headers.set("access-control-expose-headers", EXPOSED_HEADERS);
	headers.set("access-control-max-age", "600");
}
