import { useEngine } from "@/lib/engine";

export default function HealthPage() {
	const health = useEngine(
		"/system/health",
		{ query: { verbose: true } },
		{ debug: true },
	);
	const test = health.data?.testingenv;

	return (
		<section>
			<h1>Health</h1>
			<dl className="health-card">
				<div>
					<dt>Status</dt>
					<dd>
						{health.data?.status ?? (health.isLoading ? "Loading…" : "Unknown")}
					</dd>
				</div>

				<div>
					<dt>Service</dt>
					<dd>{health.data?.service ?? "Unavailable"}</dd>
				</div>

				<div>
					<dt>Rendered at</dt>
					<dd>{health.data?.timestamp ?? new Date().toLocaleString()}</dd>
				</div>

				<div>
					<dt>Testing env</dt>
					<dd>{test ?? "Unavailable"}</dd>
				</div>
			</dl>
		</section>
	);
}
