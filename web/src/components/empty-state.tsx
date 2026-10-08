import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
	icon,
	title,
	description,
	action,
	className,
}: {
	icon?: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"bg-grid flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center",
				className,
			)}
		>
			{icon && (
				<div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-surface text-fg-muted shadow-sm ring-1 ring-line">
					{icon}
				</div>
			)}
			<p className="font-semibold text-fg">{title}</p>
			{description && (
				<p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
			)}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}
