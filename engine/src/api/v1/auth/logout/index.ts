import { requestStorage } from "../../../../core/api/runtime";
import { invalidateSession } from "../../../../core/auth/sessions";

export async function createAuthLogout(): Promise<{
	success: boolean;
}> {
	const store = requestStorage.getStore();
	if (store) {
		const cookieHeader = store.request.headers.get("cookie") || "";
		const cookies = cookieHeader.split(";").reduce(
			(acc, cookie) => {
				const [key, value] = cookie.trim().split("=");
				if (key && value) acc[key] = decodeURIComponent(value);
				return acc;
			},
			{} as Record<string, string>,
		);

		const token = cookies.session;
		if (token) {
			await invalidateSession(token);
		}

		if (!store.responseHeaders) {
			store.responseHeaders = new Headers();
		}
		const isProd = process.env.NODE_ENV === "production";
		store.responseHeaders.append(
			"Set-Cookie",
			`session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT;${isProd ? " Secure;" : ""}`,
		);
	}
	return { success: true };
}
