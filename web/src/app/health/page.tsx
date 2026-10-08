import { useEngine } from "@/lib/engine";

export default function HealthPage() {
	const health = useEngine(
		"/system/health",
		{ query: { verbose: true } },
		{ refetchInterval: 5_000 },
	);

	const rows: Array<[string, string]> = [
		[
			"Status",
			health.data?.status ?? (health.isPending ? "Loading…" : "Unknown"),
		],
		["Service", health.data?.service ?? "Unavailable"],
		["Environment", health.data?.environment ?? "Unavailable"],
		["Runtime", health.data?.checks?.runtime ?? "Unavailable"],
		[
			"Uptime",
			health.data
				? `${Math.round(health.data.uptimeMs / 1000)}s`
				: "Unavailable",
		],
		["Reported at", health.data?.timestamp ?? "Unavailable"],
	];

	return (
		<section className="mx-auto max-w-xl">
			<h1 className="text-3xl font-extrabold text-slate-800">Health</h1>
			<p className="mt-1 text-sm text-slate-400">Refreshes every 5 seconds.</p>
			{health.isError && (
				<p className="mt-4 text-sm text-rose-500">{health.error.message}</p>
			)}
			<dl className="mt-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
				{rows.map(([label, value]) => (
					<div key={label} className="grid gap-1">
						<dt className="text-xs font-semibold uppercase text-slate-400">
							{label}
						</dt>
						<dd className="font-mono text-sm text-slate-700">{value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
