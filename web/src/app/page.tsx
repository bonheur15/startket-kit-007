import {
	ArrowRight,
	ArrowUpRight,
	Braces,
	Database,
	FileJson,
	Lock,
	ShieldCheck,
	TriangleAlert,
	Workflow,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CodeBlock } from "@/components/code-block";
import { GoogleSignInButton } from "@/components/google-button";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api/config";
import { useAuth } from "@/lib/auth";
import { useEngine } from "@/lib/engine";

const AUTH_ERRORS: Record<string, string> = {
	google_not_configured:
		"Google sign-in is not configured on the server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
	invalid_state:
		"The sign-in request expired or was tampered with. Please try again.",
	email_not_verified: "Your Google account email is not verified.",
	access_denied: "Sign-in was cancelled.",
};

const ENDPOINT_SNIPPET = `// engine/src/api/v1/todos/create/index.ts
export async function createTodo(input: { title: string }) {
  const user = await requireAuth();
  return db.insert(todos)
    .values({ title: input.title, userId: user.id })
    .returning();
}`;

const CLIENT_SNIPPET = `// anywhere in web/
const create = useEngineMutation("/todos/create");
create.mutate({ body: { title: "Ship it" } });`;

const FEATURES = [
	{
		icon: Braces,
		title: "Types are the contract",
		body: "Input and output types are inferred from your function and validated at runtime on both sides.",
	},
	{
		icon: Workflow,
		title: "Generated, not written",
		body: "OpenAPI 3.1, a typed fetch client and React Query hooks are regenerated on every save.",
	},
	{
		icon: Lock,
		title: "Sessions done right",
		body: "Google OAuth with PKCE, hashed session tokens, sliding expiry and redirect allow-listing.",
	},
	{
		icon: Database,
		title: "Postgres anywhere",
		body: "postgres.js on Bun, Neon over HTTP on Cloudflare Workers. Same code, picked by URL.",
	},
];

export default function HomePage() {
	const { user, isLoading: isAuthLoading } = useAuth();
	const [searchParams] = useSearchParams();
	const [message, setMessage] = useState("ping");

	const health = useEngine(
		"/health",
		{ query: { verbose: true } },
		{ refetchInterval: 15_000 },
	);
	const pingPong = useEngine("/ping-pong", { query: { message, repeat: 2 } });

	const authError = searchParams.get("auth_error");
	const online = health.isSuccess;

	return (
		<div className="space-y-20">
			{/* Hero */}
			<section className="grid items-center gap-12 lg:grid-cols-12">
				<div className="animate-rise lg:col-span-6">
					<div className="mb-6 flex flex-wrap items-center gap-2">
						<Badge variant="accent">
							<StatusDot tone={online ? "accent" : "neutral"} pulse={online} />
							{online
								? "engine online"
								: health.isPending
									? "connecting"
									: "engine offline"}
						</Badge>
						<Badge variant="outline">{health.data?.version ?? "v1"}</Badge>
						{health.data?.checks?.runtime && (
							<Badge variant="neutral">{health.data.checks.runtime}</Badge>
						)}
					</div>

					<h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-fg sm:text-5xl lg:text-6xl">
						Export a function.
						<br />
						<span className="text-fg-muted">Ship a typed API.</span>
					</h1>
					<p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">
						StarterKit 007 turns plain TypeScript functions into validated
						endpoints, an OpenAPI document and React Query hooks. Bun or
						Cloudflare Workers on the back, React 19 on the front, one generator
						in between.
					</p>

					{authError && (
						<p className="mt-6 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
							<TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
							{AUTH_ERRORS[authError] ?? `Sign-in failed (${authError}).`}
						</p>
					)}

					<div className="mt-8 flex flex-wrap items-center gap-3">
						{isAuthLoading ? (
							<div className="h-12 w-52 animate-pulse rounded-2xl bg-surface-2" />
						) : user ? (
							<>
								<Button asChild size="lg" variant="accent">
									<Link to="/dashboard">
										Open dashboard
										<ArrowRight className="size-4" aria-hidden />
									</Link>
								</Button>
								<Button asChild size="lg" variant="outline">
									<Link to="/todos">Try the todo demo</Link>
								</Button>
							</>
						) : (
							<>
								<GoogleSignInButton />
								<Button asChild size="lg" variant="ghost">
									<Link to="/about">
										How it works
										<ArrowRight className="size-4" aria-hidden />
									</Link>
								</Button>
							</>
						)}
					</div>

					<dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
						<Stat label="Endpoints" value="10" />
						<Stat label="Hand-written types" value="0" />
						<Stat label="Runtimes" value="2" />
					</dl>
				</div>

				<div className="animate-rise delay-1 lg:col-span-6">
					<div className="relative">
						<div className="bg-glow absolute -inset-6 -z-10 rounded-[2rem] opacity-80" />
						<CodeBlock
							title="engine/src/api/v1/todos/create/index.ts"
							code={ENDPOINT_SNIPPET}
						/>
						<div className="my-3 flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
							<span className="h-px flex-1 bg-line" />
							make generate
							<span className="h-px flex-1 bg-line" />
						</div>
						<CodeBlock
							title="web/src/components/todo-app.tsx"
							code={CLIENT_SNIPPET}
							copy={false}
						/>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="animate-rise delay-2">
				<div className="mb-8 flex items-end justify-between gap-4">
					<div>
						<p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong dark:text-accent">
							What you get
						</p>
						<h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
							Everything between the function and the browser
						</h2>
					</div>
					<Button asChild variant="link" className="hidden sm:inline-flex">
						<Link to="/about">
							Read the architecture
							<ArrowUpRight className="size-4" aria-hidden />
						</Link>
					</Button>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{FEATURES.map(({ icon: Icon, title, body }) => (
						<Card
							key={title}
							className="group transition-all hover:-translate-y-0.5 hover:shadow-md"
						>
							<CardContent className="p-6">
								<div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-strong transition-colors group-hover:bg-accent group-hover:text-accent-fg dark:text-accent dark:group-hover:text-accent-fg">
									<Icon className="size-5" aria-hidden />
								</div>
								<h3 className="font-semibold text-fg">{title}</h3>
								<p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
									{body}
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			</section>

			{/* Live demo */}
			<section className="animate-rise delay-3 grid gap-6 lg:grid-cols-5">
				<Card className="lg:col-span-3">
					<CardContent className="p-6 sm:p-8">
						<div className="mb-6 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Zap
									className="size-4 text-accent-strong dark:text-accent"
									aria-hidden
								/>
								<h3 className="font-semibold">Typed GET query, live</h3>
							</div>
							<Badge variant="neutral">useEngine("/ping-pong")</Badge>
						</div>
						<label
							htmlFor="ping-message"
							className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-fg-subtle"
						>
							query.message
						</label>
						<Input
							id="ping-message"
							value={message}
							onChange={(event) => setMessage(event.target.value)}
							placeholder="ping"
							className="font-mono"
						/>
						<div className="mt-5 rounded-xl border border-line bg-surface-2 p-4 font-mono text-[13px]">
							{pingPong.isError ? (
								<span className="text-danger">{pingPong.error.message}</span>
							) : pingPong.data ? (
								<pre className="overflow-x-auto text-fg">
									{JSON.stringify(
										{
											received: pingPong.data.received,
											reply: pingPong.data.reply,
											repeated: pingPong.data.repeated,
										},
										null,
										2,
									)}
								</pre>
							) : (
								<span className="text-fg-subtle">fetching…</span>
							)}
						</div>
						<p className="mt-3 text-xs text-fg-subtle">
							Every keystroke is a cached, de-duplicated request. Numbers in the
							query string are coerced and validated by the engine.
						</p>
					</CardContent>
				</Card>

				<Card className="bg-ink text-ink-fg lg:col-span-2">
					<CardContent className="flex h-full flex-col p-6 sm:p-8">
						<div className="mb-6 flex items-center gap-2">
							<ShieldCheck className="size-4 text-accent" aria-hidden />
							<h3 className="font-semibold">Engine status</h3>
						</div>
						<dl className="space-y-3 font-mono text-[13px]">
							<Row
								label="status"
								value={
									health.data?.status ??
									(health.isPending ? "…" : "unreachable")
								}
								ok={online}
							/>
							<Row
								label="environment"
								value={health.data?.environment ?? "—"}
							/>
							<Row
								label="runtime"
								value={health.data?.checks?.runtime ?? "—"}
							/>
							<Row
								label="uptime"
								value={
									health.data
										? `${Math.round(health.data.uptimeMs / 1000)}s`
										: "—"
								}
							/>
							<Row
								label="base url"
								value={API_BASE_URL.replace(/^https?:\/\//, "")}
							/>
						</dl>
						<div className="mt-auto flex gap-2 pt-8">
							<Button
								asChild
								size="sm"
								variant="soft"
								className="bg-ink-3 text-ink-fg hover:bg-ink-line"
							>
								<a
									href={`${API_BASE_URL}/openapi.json`}
									target="_blank"
									rel="noreferrer"
								>
									<FileJson className="size-3.5" aria-hidden />
									OpenAPI
								</a>
							</Button>
							<Button
								asChild
								size="sm"
								variant="soft"
								className="bg-ink-3 text-ink-fg hover:bg-ink-line"
							>
								<Link to="/health">Full status</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			</section>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
				{label}
			</dt>
			<dd className="tabular mt-1 text-2xl font-semibold text-fg">{value}</dd>
		</div>
	);
}

function Row({
	label,
	value,
	ok,
}: {
	label: string;
	value: string;
	ok?: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-4 border-b border-ink-line pb-3 last:border-0 last:pb-0">
			<dt className="text-ink-muted">{label}</dt>
			<dd className="flex items-center gap-2 text-right text-ink-fg">
				{ok !== undefined && (
					<StatusDot tone={ok ? "accent" : "danger"} pulse={ok} />
				)}
				{value}
			</dd>
		</div>
	);
}
