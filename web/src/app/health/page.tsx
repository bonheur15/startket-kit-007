import { Activity, RefreshCw } from "lucide-react";
import { useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/api/config";
import { useEngine } from "@/lib/engine";

function formatUptime(ms: number): string {
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function HealthPage() {
	const [showRaw, setShowRaw] = useState(false);
	const health = useEngine(
		"/system/health",
		{ query: { verbose: true } },
		{ refetchInterval: 5_000 },
	);

	const online = health.isSuccess;
	const tone = online ? "accent" : health.isPending ? "neutral" : "danger";

	const metrics: Array<{ label: string; value: string; mono?: boolean }> = [
		{
			label: "Status",
			value:
				health.data?.status ?? (health.isPending ? "checking" : "unreachable"),
		},
		{ label: "Service", value: health.data?.service ?? "—", mono: true },
		{
			label: "Environment",
			value: health.data?.environment ?? "—",
			mono: true,
		},
		{
			label: "Runtime",
			value: health.data?.checks?.runtime ?? "—",
			mono: true,
		},
		{
			label: "Uptime",
			value: health.data ? formatUptime(health.data.uptimeMs) : "—",
			mono: true,
		},
		{ label: "API version", value: health.data?.version ?? "—", mono: true },
	];

	return (
		<div className="mx-auto max-w-4xl">
			<PageHeader
				eyebrow="Status"
				title={
					<span className="flex items-center gap-3">
						<StatusDot tone={tone} pulse={online} className="size-3" />
						{online
							? "All systems operational"
							: health.isPending
								? "Checking…"
								: "Engine unreachable"}
					</span>
				}
				description={
					<>
						Polling{" "}
						<code className="font-mono">
							{API_BASE_URL}/api/v1/system/health
						</code>{" "}
						every 5 seconds through the generated client.
					</>
				}
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void health.refetch()}
							disabled={health.isFetching}
						>
							<RefreshCw
								className={
									health.isFetching ? "size-3.5 animate-spin" : "size-3.5"
								}
								aria-hidden
							/>
							Refresh
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowRaw((v) => !v)}
						>
							{showRaw ? "Hide JSON" : "Show JSON"}
						</Button>
					</>
				}
			/>

			{health.isError && (
				<Card className="mb-6 border-danger/30 bg-danger-soft">
					<CardContent className="flex items-start gap-3 p-5 text-sm text-danger">
						<Activity className="mt-0.5 size-4 shrink-0" aria-hidden />
						<div>
							<p className="font-semibold">{health.error.message}</p>
							<p className="mt-1 text-xs opacity-80">
								Is the engine running? Start it with <code>make dev</code> and
								check <code>VITE_API_BASE_URL</code>.
							</p>
						</div>
					</CardContent>
				</Card>
			)}

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{metrics.map((metric) => (
					<Card key={metric.label}>
						<CardContent className="p-5">
							<p className="font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
								{metric.label}
							</p>
							<p
								className={
									metric.mono
										? "mt-2 truncate font-mono text-lg text-fg"
										: "mt-2 text-lg font-semibold capitalize text-fg"
								}
							>
								{metric.value}
							</p>
						</CardContent>
					</Card>
				))}
			</div>

			<div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
				<Badge variant="neutral">last update</Badge>
				<span className="font-mono">{health.data?.timestamp ?? "—"}</span>
				{health.isFetching && <span className="font-mono">· refreshing</span>}
			</div>

			{showRaw && health.data && (
				<CodeBlock
					className="mt-6"
					title="GET /api/v1/system/health?verbose=true"
					code={JSON.stringify(health.data, null, 2)}
				/>
			)}
		</div>
	);
}
