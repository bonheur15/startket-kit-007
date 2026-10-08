import { TriangleAlert } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Button } from "@/components/ui/button";
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
		<section className="bg-grid mx-auto max-w-lg rounded-3xl border border-line bg-surface/80 p-10 text-center shadow-md">
			<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
				<TriangleAlert className="size-6" aria-hidden />
			</div>
			<h1 className="mt-5 text-2xl font-semibold tracking-tight text-fg">
				{title}
			</h1>
			<p className="mt-2 text-sm text-fg-muted">{detail}</p>
			{requestId && (
				<p className="mt-3 font-mono text-[11px] text-fg-subtle">
					request id · {requestId}
				</p>
			)}
			<div className="mt-7 flex justify-center gap-3">
				<Button onClick={() => window.location.reload()}>Reload</Button>
				<Button asChild variant="outline">
					<Link to="/">Go home</Link>
				</Button>
			</div>
		</section>
	);
}
