import { cn } from "@/lib/utils";

type Tone = "accent" | "warn" | "danger" | "neutral";

const tones: Record<Tone, string> = {
	accent: "bg-accent",
	warn: "bg-warn",
	danger: "bg-danger",
	neutral: "bg-fg-subtle",
};

export function StatusDot({
	tone = "accent",
	pulse = false,
	className,
}: {
	tone?: Tone;
	pulse?: boolean;
	className?: string;
}) {
	return (
		<span
			aria-hidden
			className={cn(
				"inline-block size-2 rounded-full",
				tones[tone],
				pulse &&
					tone === "accent" &&
					"[animation:pulse-dot_1.8s_ease-out_infinite]",
				className,
			)}
		/>
	);
}
