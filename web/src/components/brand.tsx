import { Link } from "react-router";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				"relative inline-flex size-8 items-center justify-center overflow-hidden rounded-lg bg-accent font-mono text-[11px] font-bold tracking-tighter text-accent-fg shadow-sm",
				className,
			)}
		>
			<span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.35),transparent_60%)]" />
			<span className="relative">007</span>
		</span>
	);
}

export function Brand({ inverted = false }: { inverted?: boolean }) {
	return (
		<Link
			to="/"
			className={cn(
				"group flex items-center gap-2.5 text-[15px] font-semibold tracking-tight",
				inverted ? "text-ink-fg" : "text-fg",
			)}
		>
			<BrandMark className="transition-transform group-hover:-rotate-6" />
			<span>
				StarterKit
				<span className={inverted ? "text-ink-muted" : "text-fg-subtle"}>
					{" "}
					/{" "}
				</span>
				<span className="font-mono text-sm font-medium">engine</span>
			</span>
		</Link>
	);
}
