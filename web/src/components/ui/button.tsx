import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent font-semibold transition-all duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-accent/40 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default:
					"bg-ink text-ink-fg shadow-sm hover:bg-ink-3 dark:bg-ink-fg dark:text-ink dark:hover:bg-white",
				accent: "bg-accent text-accent-fg shadow-sm hover:bg-accent-strong",
				outline: "border-line-strong bg-surface text-fg hover:bg-surface-2",
				ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
				soft: "bg-surface-2 text-fg hover:bg-surface-3",
				danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
				link: "text-accent-strong underline-offset-4 hover:underline dark:text-accent",
			},
			size: {
				default: "h-10 px-4 text-sm",
				sm: "h-8 rounded-lg px-3 text-xs",
				lg: "h-12 rounded-2xl px-6 text-base",
				icon: "size-10",
				"icon-sm": "size-8 rounded-lg",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";
	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
