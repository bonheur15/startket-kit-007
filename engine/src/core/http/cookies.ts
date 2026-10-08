export type CookieOptions = {
	maxAge?: number;
	expires?: Date;
	domain?: string;
	path?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: "lax" | "strict" | "none";
};

export function parseCookies(header: string | null): Record<string, string> {
	const cookies: Record<string, string> = {};
	if (!header) return cookies;

	for (const part of header.split(";")) {
		const separator = part.indexOf("=");
		if (separator === -1) continue;
		const name = part.slice(0, separator).trim();
		const value = part.slice(separator + 1).trim();
		if (!name) continue;
		try {
			cookies[name] = decodeURIComponent(value);
		} catch {
			cookies[name] = value;
		}
	}

	return cookies;
}

export function serializeCookie(
	name: string,
	value: string,
	options: CookieOptions = {},
): string {
	const parts = [`${name}=${encodeURIComponent(value)}`];

	if (options.maxAge !== undefined)
		parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
	if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
	if (options.domain) parts.push(`Domain=${options.domain}`);
	parts.push(`Path=${options.path ?? "/"}`);
	if (options.httpOnly ?? true) parts.push("HttpOnly");
	if (options.secure) parts.push("Secure");
	if (options.sameSite) {
		parts.push(
			`SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`,
		);
	}

	return parts.join("; ");
}
