import { and, eq } from "drizzle-orm";
import { endpoints } from "../.generated/endpoints";
import { createRuntime } from "./core/api/runtime";
import { createSession } from "./core/auth/sessions";
import { db } from "./db";
import { accounts, users } from "./db/schema";

export function createApp() {
	return createRuntime({
		endpoints: [...endpoints],
		// NOTE: Bypassing the RPC generator is highly unadvisable for standard API development.
		// Always use the proper function-first RPC pattern that this framework was made to be used with,
		// and reserve this custom escape hatch strictly for special needs like file uploads or webhooks.
		rawFetch: async (request) => {
			const url = new URL(request.url);

			// Google OAuth Login initiation endpoint
			if (
				request.method === "GET" &&
				url.pathname === "/api/auth/google/login"
			) {
				const redirectUri = url.searchParams.get("redirect_uri");
				const googleClientId = process.env.GOOGLE_CLIENT_ID;
				const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL;

				if (!googleClientId || !googleCallbackUrl) {
					return new Response(
						JSON.stringify({
							error:
								"Google OAuth credentials are not fully configured on the server.",
						}),
						{ status: 500, headers: { "Content-Type": "application/json" } },
					);
				}

				const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
				authUrl.searchParams.set("client_id", googleClientId);
				authUrl.searchParams.set("redirect_uri", googleCallbackUrl);
				authUrl.searchParams.set("response_type", "code");
				authUrl.searchParams.set("scope", "openid email profile");
				authUrl.searchParams.set("state", redirectUri || "");
				authUrl.searchParams.set("access_type", "online");

				return new Response(null, {
					status: 302,
					headers: {
						Location: authUrl.toString(),
					},
				});
			}

			// Google OAuth Callback endpoint
			if (
				request.method === "GET" &&
				url.pathname === "/api/auth/google/callback"
			) {
				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");

				if (!code) {
					return new Response("Missing authorization code from Google.", {
						status: 400,
					});
				}

				const googleClientId = process.env.GOOGLE_CLIENT_ID;
				const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
				const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL;

				if (!googleClientId || !googleClientSecret || !googleCallbackUrl) {
					return new Response("Google OAuth is not configured on the server.", {
						status: 500,
					});
				}

				try {
					// Exchange code for Google access token
					const tokenResponse = await fetch(
						"https://oauth2.googleapis.com/token",
						{
							method: "POST",
							headers: { "Content-Type": "application/x-www-form-urlencoded" },
							body: new URLSearchParams({
								code,
								client_id: googleClientId,
								client_secret: googleClientSecret,
								redirect_uri: googleCallbackUrl,
								grant_type: "authorization_code",
							}),
						},
					);

					if (!tokenResponse.ok) {
						const errData = await tokenResponse.text();
						console.error("Token exchange failed:", errData);
						return new Response("Failed to exchange authentication code.", {
							status: 400,
						});
					}

					const { access_token } = await tokenResponse.json();

					// Fetch Google User profile
					const profileResponse = await fetch(
						"https://www.googleapis.com/oauth2/v2/userinfo",
						{
							headers: { Authorization: `Bearer ${access_token}` },
						},
					);

					if (!profileResponse.ok) {
						return new Response("Failed to fetch user profile from Google.", {
							status: 400,
						});
					}

					const googleProfile = (await profileResponse.json()) as {
						id: string;
						email: string;
						name: string;
						picture: string;
					};

					let userId: number;

					// Check if account links mapping exists
					const [existingAccount] = await db
						.select()
						.from(accounts)
						.where(
							and(
								eq(accounts.provider, "google"),
								eq(accounts.providerAccountId, googleProfile.id),
							),
						)
						.limit(1);

					if (existingAccount) {
						userId = existingAccount.userId;
						// Update details in user profile
						await db
							.update(users)
							.set({
								name: googleProfile.name,
								picture: googleProfile.picture,
							})
							.where(eq(users.id, userId));
					} else {
						// Check if user email already exists
						const [existingUser] = await db
							.select()
							.from(users)
							.where(eq(users.email, googleProfile.email))
							.limit(1);

						if (existingUser) {
							userId = existingUser.id;
							// Link Google account to this existing user
							await db.insert(accounts).values({
								userId,
								provider: "google",
								providerAccountId: googleProfile.id,
							});
							await db
								.update(users)
								.set({
									name: googleProfile.name,
									picture: googleProfile.picture,
								})
								.where(eq(users.id, userId));
						} else {
							const [newUser] = await db
								.insert(users)
								.values({
									email: googleProfile.email,
									name: googleProfile.name,
									picture: googleProfile.picture,
								})
								.returning();

							if (!newUser) {
								throw new Error("Failed to create user record.");
							}

							userId = newUser.id;

							// Create account link
							await db.insert(accounts).values({
								userId,
								provider: "google",
								providerAccountId: googleProfile.id,
							});
						}
					}

					// Create a session in DB
					const sessionToken = await createSession(userId, false);

					const targetUrl = state || "http://localhost:5173/dashboard";
					const isProd = process.env.NODE_ENV === "production";
					const cookie = `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800;${isProd ? " Secure;" : ""}`;

					return new Response(null, {
						status: 302,
						headers: {
							Location: targetUrl,
							"Set-Cookie": cookie,
						},
					});
				} catch (error) {
					console.error("OAuth callback error:", error);
					return new Response("Unexpected error during authentication.", {
						status: 500,
					});
				}
			}

			// Example: Custom escape hatch for file uploads
			if (request.method === "POST" && url.pathname === "/api/upload") {
				// Process raw request here (e.g. await request.formData())
				return new Response(
					JSON.stringify({ success: true, message: "Upload received" }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// Return undefined to let the auto-generated RPC router handle everything else
			return undefined;
		},
	});
}
