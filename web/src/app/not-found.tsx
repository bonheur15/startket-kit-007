import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
	const location = useLocation();

	return (
		<section className="bg-grid mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-line bg-surface/70 px-8 py-16 text-center">
			<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
				Error
			</p>
			<p className="mt-2 font-mono text-7xl font-semibold tracking-tighter text-fg">
				404
			</p>
			<h1 className="mt-4 text-xl font-semibold tracking-tight text-fg">
				No route matches
			</h1>
			<p className="mt-2 max-w-sm text-sm text-fg-muted">
				Nothing lives at{" "}
				<code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-fg">
					{location.pathname}
				</code>
				. Add a <code className="font-mono">page.tsx</code> under{" "}
				<code className="font-mono">src/app</code> to create it.
			</p>
			<Button asChild className="mt-8">
				<Link to="/">
					<ArrowLeft className="size-4" aria-hidden />
					Back home
				</Link>
			</Button>
		</section>
	);
}
