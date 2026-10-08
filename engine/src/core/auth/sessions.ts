import { eq, lt } from "drizzle-orm";
import { env } from "../../config/env";
import { db } from "../../db";
import { sessions, type User, users } from "../../db/schema";
import { parseCookies, serializeCookie } from "../http/cookies";

export const SESSION_COOKIE = "session";

const TOKEN_PREFIX = "session_";

/**
 * Sessions are stored by the SHA-256 hash of the token. A leaked database
 * dump therefore cannot be replayed as valid cookies.
 */
async function hashToken(token: string): Promise<string> {
	const data = new TextEncoder().encode(token);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function randomToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const hex = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `${TOKEN_PREFIX}${hex}`;
}

export async function createSession(userId: number): Promise<string> {
	const token = randomToken();
	const expiresAt = new Date(Date.now() + env.sessionTtlMs);

	await db.insert(sessions).values({
		id: await hashToken(token),
		userId,
		expiresAt,
	});

	return token;
}

export type ValidatedSession = {
	user: User;
	expiresAt: Date;
};

/**
 * Resolve a session token to its user. Expired sessions are deleted.
 * Sessions past the halfway point of their lifetime are silently extended
 * (sliding expiration) so active users are never logged out.
 */
export async function validateSession(
	token: string,
): Promise<ValidatedSession | null> {
	if (!token.startsWith(TOKEN_PREFIX)) return null;

	const id = await hashToken(token);
	const [row] = await db
		.select({
			expiresAt: sessions.expiresAt,
			user: users,
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id))
		.limit(1);

	if (!row) return null;

	const now = Date.now();
	if (row.expiresAt.getTime() <= now) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}

	let expiresAt = row.expiresAt;
	if (row.expiresAt.getTime() - now < env.sessionTtlMs / 2) {
		expiresAt = new Date(now + env.sessionTtlMs);
		await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
	}

	return { user: row.user, expiresAt };
}

export async function invalidateSession(token: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, await hashToken(token)));
}

/** Sign the user out everywhere. */
export async function invalidateUserSessions(userId: number): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function cleanExpiredSessions(): Promise<void> {
	await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export function getSessionTokenFromRequest(
	request: Request,
): string | undefined {
	return parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
}

export function sessionCookie(token: string): string {
	return serializeCookie(SESSION_COOKIE, token, {
		maxAge: env.sessionTtlMs / 1000,
		httpOnly: true,
		secure: env.cookieSecure,
		sameSite: env.cookieSameSite,
		domain: env.cookieDomain,
		path: "/",
	});
}

export function clearSessionCookie(): string {
	return serializeCookie(SESSION_COOKIE, "", {
		maxAge: 0,
		expires: new Date(0),
		httpOnly: true,
		secure: env.cookieSecure,
		sameSite: env.cookieSameSite,
		domain: env.cookieDomain,
		path: "/",
	});
}
