import { getRequestContext } from "../../../../core/api/context";
import {
	clearSessionCookie,
	getSessionTokenFromRequest,
	invalidateSession,
} from "../../../../core/auth/sessions";

/**
 * Sign out of the current session.
 * Revokes the session server-side and clears the cookie. Always succeeds.
 */
export async function createAuthLogout(): Promise<{ success: boolean }> {
	const context = getRequestContext();
	const token = getSessionTokenFromRequest(context.request);
	if (token) await invalidateSession(token);
	context.responseHeaders.append("set-cookie", clearSessionCookie());
	return { success: true };
}
