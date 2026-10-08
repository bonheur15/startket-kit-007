import { endpoints } from "../.generated/endpoints";
import { createRuntime } from "./core/api/runtime";
import { googleAuthRoutes } from "./core/auth/google";

/**
 * Assembles the HTTP application:
 *
 * - `endpoints`  — generated from `src/api/**` (typed RPC, OpenAPI, client)
 * - `rawRoutes`  — explicit routes for things that are not JSON function calls
 * - `onError`    — hook unexpected failures into your error tracker
 */
export function createApp() {
	return createRuntime({
		endpoints,
		rawRoutes: [
			...googleAuthRoutes,

			// Example escape hatch: multipart upload. Replace or remove.
			{
				method: "POST",
				path: "/api/upload",
				async handler(context) {
					const form = await context.request.formData();
					const file = form.get("file");
					return Response.json({
						ok: true,
						data: {
							received: file instanceof File ? file.name : null,
							requestId: context.requestId,
						},
					});
				},
			},
		],
		onError(error, context) {
			// e.g. Sentry.captureException(error, { extra: { requestId: context.requestId } });
			void error;
			void context;
		},
	});
}

export type App = ReturnType<typeof createApp>;
