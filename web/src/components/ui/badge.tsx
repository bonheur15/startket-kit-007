import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider [&_svg]:size-3",
	{
		variants: {
			variant: {
				neutral: "border-line bg-surface-2 text-fg-muted",
				accent:
					"border-transparent bg-accent-soft text-accent-strong dark:text-accent",
				info: "border-transparent bg-info-soft text-info",
				warn: "border-transparent bg-warn-soft text-warn",
				danger: "border-transparent bg-danger-soft text-danger",
				ink: "border-transparent bg-ink text-ink-fg",
				outline: "border-line-strong bg-transparent text-fg",
			},
		},
		defaultVariants: { variant: "neutral" },
	},
);

function Badge({
	className,
	variant,
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return (
		<span className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };
