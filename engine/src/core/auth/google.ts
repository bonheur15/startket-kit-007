import { and, eq } from "drizzle-orm";
import { env } from "../../config/env";
import { db } from "../../db";
import { accounts, users } from "../../db/schema";
import type { RequestContext } from "../api/context";
import { defineRawRoutes } from "../api/raw";
import { parseCookies, serializeCookie } from "../http/cookies";
import { isOriginAllowed } from "../http/cors";
import { createSession, sessionCookie } from "./sessions";

/**
 * Google OAuth 2.0 (Authorization Code + PKCE).
 *
 *   GET /api/auth/google/login?redirect=/dashboard
 *   GET /api/auth/google/callback?code=...&state=...
 *
 * A random `state` and the PKCE verifier are kept in a short-lived HttpOnly
 * cookie and checked on callback, which defends against login CSRF. The
 * post-login redirect is restricted to the web app or an allowed CORS origin,
 * which prevents open redirects.
 */

const STATE_COOKIE = "oauth_state";
const STATE_TTL_SECONDS = 10 * 60;
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

type GoogleProfile = {
	sub: string;
	email?: string;
	email_verified?: boolean;
	name?: string;
	picture?: string;
};

function base64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function randomString(bytes = 32): string {
	const buffer = new Uint8Array(bytes);
	crypto.getRandomValues(buffer);
	return base64Url(buffer);
}

async function sha256Base64Url(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return base64Url(new Uint8Array(digest));
}

/**
 * Only allow redirects to the web app (relative paths) or to an explicitly
 * allowed origin. Everything else falls back to the web app root.
 */
export function resolveRedirectTarget(candidate: string | null): string {
	if (!candidate) return env.webUrl;

	if (candidate.startsWith("/") && !candidate.startsWith("//")) {
		return `${env.webUrl}${candidate}`;
	}

	try {
		const url = new URL(candidate);
		if (
			url.origin === new URL(env.webUrl).origin ||
			isOriginAllowed(url.origin)
		) {
			return url.toString();
		}
	} catch {
		// fallthrough
	}

	return env.webUrl;
}

function stateCookie(value: string, maxAge: number): string {
	return serializeCookie(STATE_COOKIE, value, {
		maxAge,
		httpOnly: true,
		secure: env.cookieSecure,
		// Lax is enough: the callback is a top-level navigation from Google.
		sameSite: "lax",
		path: "/api/auth",
	});
}

function redirectWithError(code: string, context: RequestContext): Response {
	context.logger.warn("google oauth failed", { reason: code });
	const target = new URL(env.webUrl);
	target.searchParams.set("auth_error", code);
	return new Response(null, {
		status: 302,
		headers: { location: target.toString(), "set-cookie": stateCookie("", 0) },
	});
}

function requireGoogleConfig() {
	const { clientId, clientSecret, callbackUrl } = env.google;
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret, callbackUrl };
}

async function upsertGoogleUser(profile: GoogleProfile): Promise<number> {
	const email = profile.email?.toLowerCase();
	if (!email) throw new Error("Google profile has no email");

	const [existingAccount] = await db
		.select({ userId: accounts.userId })
		.from(accounts)
		.where(
			and(
				eq(accounts.provider, "google"),
				eq(accounts.providerAccountId, profile.sub),
			),
		)
		.limit(1);

	if (existingAccount) {
		await db
			.update(users)
			.set({ name: profile.name ?? null, picture: profile.picture ?? null })
			.where(eq(users.id, existingAccount.userId));
		return existingAccount.userId;
	}

	const [existingUser] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	let userId: number;
	if (existingUser) {
		userId = existingUser.id;
		await db
			.update(users)
			.set({ name: profile.name ?? null, picture: profile.picture ?? null })
			.where(eq(users.id, userId));
	} else {
		const [created] = await db
			.insert(users)
			.values({
				email,
				name: profile.name ?? null,
				picture: profile.picture ?? null,
			})
			.returning({ id: users.id });
		if (!created) throw new Error("Failed to create user");
		userId = created.id;
	}

	await db.insert(accounts).values({
		userId,
		provider: "google",
		providerAccountId: profile.sub,
	});

	return userId;
}

export const googleAuthRoutes = defineRawRoutes([
	{
		method: "GET",
		path: "/api/auth/google/login",
		async handler(context) {
			const config = requireGoogleConfig();
			if (!config) return redirectWithError("google_not_configured", context);

			const redirectTarget = resolveRedirectTarget(
				context.url.searchParams.get("redirect") ??
					context.url.searchParams.get("redirect_uri"),
			);
			const state = randomString(16);
			const verifier = randomString(48);
			const challenge = await sha256Base64Url(verifier);

			const authUrl = new URL(GOOGLE_AUTH_URL);
			authUrl.searchParams.set("client_id", config.clientId);
			authUrl.searchParams.set("redirect_uri", config.callbackUrl);
			authUrl.searchParams.set("response_type", "code");
			authUrl.searchParams.set("scope", "openid email profile");
			authUrl.searchParams.set("state", state);
			authUrl.searchParams.set("code_challenge", challenge);
			authUrl.searchParams.set("code_challenge_method", "S256");
			authUrl.searchParams.set("access_type", "online");
			authUrl.searchParams.set("prompt", "select_account");

			const payload = JSON.stringify({
				state,
				verifier,
				redirect: redirectTarget,
			});
			return new Response(null, {
				status: 302,
				headers: {
					location: authUrl.toString(),
					"set-cookie": stateCookie(payload, STATE_TTL_SECONDS),
					"cache-control": "no-store",
				},
			});
		},
	},
	{
		method: "GET",
		path: "/api/auth/google/callback",
		async handler(context) {
			const config = requireGoogleConfig();
			if (!config) return redirectWithError("google_not_configured", context);

			const code = context.url.searchParams.get("code");
			const state = context.url.searchParams.get("state");
			const providerError = context.url.searchParams.get("error");
			if (providerError) return redirectWithError(providerError, context);
			if (!code || !state) return redirectWithError("missing_code", context);

			const rawState = parseCookies(context.request.headers.get("cookie"))[
				STATE_COOKIE
			];
			let stored:
				| { state: string; verifier: string; redirect: string }
				| undefined;
			try {
				stored = rawState ? JSON.parse(rawState) : undefined;
			} catch {
				stored = undefined;
			}
			if (!stored || stored.state !== state)
				return redirectWithError("invalid_state", context);

			try {
				const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
					method: "POST",
					headers: { "content-type": "application/x-www-form-urlencoded" },
					body: new URLSearchParams({
						code,
						client_id: config.clientId,
						client_secret: config.clientSecret,
						redirect_uri: config.callbackUrl,
						grant_type: "authorization_code",
						code_verifier: stored.verifier,
					}),
				});

				if (!tokenResponse.ok) {
					context.logger.error("google token exchange failed", {
						status: tokenResponse.status,
						body: await tokenResponse.text(),
					});
					return redirectWithError("token_exchange_failed", context);
				}

				const { access_token: accessToken } = (await tokenResponse.json()) as {
					access_token?: string;
				};
				if (!accessToken)
					return redirectWithError("token_exchange_failed", context);

				const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
					headers: { authorization: `Bearer ${accessToken}` },
				});
				if (!profileResponse.ok)
					return redirectWithError("profile_fetch_failed", context);

				const profile = (await profileResponse.json()) as GoogleProfile;
				if (!profile.email || profile.email_verified === false) {
					return redirectWithError("email_not_verified", context);
				}

				const userId = await upsertGoogleUser(profile);
				const token = await createSession(userId);
				context.logger.info("user signed in", { userId, provider: "google" });

				const headers = new Headers({
					location: resolveRedirectTarget(stored.redirect),
					"cache-control": "no-store",
				});
				headers.append("set-cookie", sessionCookie(token));
				headers.append("set-cookie", stateCookie("", 0));
				return new Response(null, { status: 302, headers });
			} catch (error) {
				context.logger.error("google oauth callback error", { error });
				return redirectWithError("unexpected_error", context);
			}
		},
	},
]);
