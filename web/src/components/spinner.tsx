import { Loader2 } from "lucide-react";

export function Spinner({ label = "Loading…" }: { label?: string }) {
	return (
		<div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
			<Loader2
				className="size-6 animate-spin text-accent-strong dark:text-accent"
				aria-hidden
			/>
			<p className="font-mono text-xs uppercase tracking-widest text-fg-subtle">
				{label}
			</p>
		</div>
	);
}
