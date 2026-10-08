import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
	className,
}: {
	eyebrow?: string;
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	className?: string;
}) {
	return (
		<header
			className={cn(
				"mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
				className,
			)}
		>
			<div className="min-w-0">
				{eyebrow && (
					<p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:text-accent">
						{eyebrow}
					</p>
				)}
				<h1 className="text-balance text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
					{title}
				</h1>
				{description && (
					<p className="mt-2 max-w-2xl text-sm text-fg-muted sm:text-base">
						{description}
					</p>
				)}
			</div>
			{actions && (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			)}
		</header>
	);
}
