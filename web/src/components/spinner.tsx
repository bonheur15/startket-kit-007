import { Loader2 } from "lucide-react";

export function Spinner({ label = "Loading…" }: { label?: string }) {
	return (
		<div className="flex min-h-[320px] flex-col items-center justify-center gap-2">
			<Loader2 className="h-7 w-7 animate-spin text-amber-500" aria-hidden />
			<p className="text-sm font-medium text-slate-400">{label}</p>
		</div>
	);
}
