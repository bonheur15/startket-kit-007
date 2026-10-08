import type { User } from "../../db/schema";
import { getRequestContext } from "../api/context";
import { errors } from "../api/error";

/**
 * Returns the authenticated user or throws a 401.
 *
 * ```ts
 * export async function getSecret() {
 *   const user = await requireAuth();
 *   return { hello: user.email };
 * }
 * ```
 */
export async function requireAuth(): Promise<User> {
	const user = await getRequestContext().user();
	if (!user) throw errors.unauthorized();
	return user;
}

/** Returns the authenticated user, or `null` for anonymous requests. */
export async function getUser(): Promise<User | null> {
	return getRequestContext().user();
}
