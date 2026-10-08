import type * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			data-slot="input"
			className={cn(
				"h-10 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-fg shadow-sm transition-colors placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
