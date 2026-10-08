import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CodeBlock({
	code,
	title,
	className,
	copy = true,
}: {
	code: string;
	title?: string;
	className?: string;
	copy?: boolean;
}) {
	const [copied, setCopied] = useState(false);

	const onCopy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard can be unavailable over http; ignore.
		}
	};

	return (
		<div
			className={cn(
				"overflow-hidden rounded-xl border border-ink-line bg-ink-2 text-[13px] leading-relaxed text-ink-fg shadow-md",
				className,
			)}
		>
			{(title || copy) && (
				<div className="flex items-center justify-between border-b border-ink-line px-4 py-2">
					<div className="flex items-center gap-2">
						<span className="flex gap-1.5">
							<i className="size-2.5 rounded-full bg-danger/80" />
							<i className="size-2.5 rounded-full bg-warn/80" />
							<i className="size-2.5 rounded-full bg-accent/80" />
						</span>
						{title && (
							<span className="ml-2 font-mono text-xs text-ink-muted">
								{title}
							</span>
						)}
					</div>
					{copy && (
						<button
							type="button"
							onClick={onCopy}
							className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-ink-muted transition-colors hover:bg-ink-3 hover:text-ink-fg"
						>
							{copied ? (
								<Check className="size-3" />
							) : (
								<Copy className="size-3" />
							)}
							{copied ? "copied" : "copy"}
						</button>
					)}
				</div>
			)}
			<pre className="overflow-x-auto px-4 py-4 font-mono">
				<code>{code}</code>
			</pre>
		</div>
	);
}
