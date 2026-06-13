import { eq, lt } from "drizzle-orm";
import { db } from "../../db";
import { sessions, type User, users } from "../../db/schema";

export async function createSession(
	userId: number,
	isTemporary = false,
): Promise<string> {
	const randomBytes = new Uint8Array(32);
	crypto.getRandomValues(randomBytes);
	const randomHex = Array.from(randomBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	const version = isTemporary ? "tmp" : "v1";
	const sessionToken = `session_${randomHex}.${version}`;

	const duration = isTemporary ? 5 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
	const expiresAt = new Date(Date.now() + duration);

	await db.insert(sessions).values({
		id: sessionToken,
		userId,
		expiresAt,
	});

	return sessionToken;
}

export async function validateSession(
	sessionToken: string,
): Promise<User | null> {
	if (!sessionToken.startsWith("session_")) {
		return null;
	}

	const [session] = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, sessionToken))
		.limit(1);

	if (!session) {
		return null;
	}

	const isExpired = session.expiresAt.getTime() < Date.now();

	// If it is a temporary session or expired, delete it immediately
	if (sessionToken.endsWith(".tmp") || isExpired) {
		await db.delete(sessions).where(eq(sessions.id, sessionToken));
	}

	if (isExpired) {
		return null;
	}

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1);

	return user ?? null;
}

export async function invalidateSession(sessionToken: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionToken));
}

export async function cleanExpiredSessions(): Promise<void> {
	await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
