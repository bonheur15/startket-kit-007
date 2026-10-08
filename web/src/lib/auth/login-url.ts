import { API_BASE_URL } from "@/lib/api/config";

/**
 * URL that starts the Google sign-in flow. `redirectTo` is a path inside the
 * web app the user returns to after signing in (validated server-side).
 */
export function getLoginUrl(redirectTo = "/dashboard"): string {
	const url = new URL(`${API_BASE_URL}/api/auth/google/login`);
	url.searchParams.set("redirect", redirectTo);
	return url.toString();
}
