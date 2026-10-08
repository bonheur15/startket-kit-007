import { AlertTriangle } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { isApiClientError } from "@/lib/engine";

/**
 * Route-level error UI. Export this as `ErrorBoundary` from a `layout.tsx` or
 * `page.tsx` to override it for a subtree.
 */
export function RouteErrorBoundary() {
	const error = useRouteError();

	let title = "Something went wrong";
	let detail = "An unexpected error occurred while rendering this page.";
	let requestId: string | undefined;

	if (isRouteErrorResponse(error)) {
		title = `${error.status} ${error.statusText}`;
		detail = typeof error.data === "string" ? error.data : detail;
	} else if (isApiClientError(error)) {
		title = `API error (${error.code})`;
		detail = error.message;
		requestId = error.requestId;
	} else if (error instanceof Error) {
		detail = error.message;
	}

	if (import.meta.env.DEV) console.error(error);

	return (
		<section className="mx-auto max-w-xl rounded-3xl border border-rose-100 bg-rose-50/60 p-8 text-center">
			<AlertTriangle className="mx-auto h-8 w-8 text-rose-500" aria-hidden />
			<h1 className="mt-4 text-2xl font-extrabold text-slate-900">{title}</h1>
			<p className="mt-2 text-sm text-slate-600">{detail}</p>
			{requestId && (
				<p className="mt-2 font-mono text-xs text-slate-400">
					request id: {requestId}
				</p>
			)}
			<div className="mt-6 flex justify-center gap-3">
				<button
					type="button"
					onClick={() => window.location.reload()}
					className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
				>
					Reload
				</button>
				<Link
					to="/"
					className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
				>
					Go home
				</Link>
			</div>
		</section>
	);
}
