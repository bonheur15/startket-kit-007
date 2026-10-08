import {
	Activity,
	ArrowRight,
	ArrowRightLeft,
	FileJson,
	Server,
	ShieldAlert,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { GoogleSignInButton } from "@/components/google-button";
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

export default function HomePage() {
	const { user, isLoading: isAuthLoading } = useAuth();
	const [searchParams] = useSearchParams();
	const [message, setMessage] = useState("ping");

	const health = useEngine("/health", { query: { verbose: true } });
	const pingPong = useEngine("/ping-pong", { query: { message, repeat: 2 } });

	const authError = searchParams.get("auth_error");

	return (
		<section className="grid items-center gap-8 py-6 md:grid-cols-12">
			<div className="flex flex-col space-y-6 md:col-span-7">
				<div className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600">
					<Sparkles size={14} aria-hidden />
					<span>Function-first, end-to-end typed</span>
				</div>
				<h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
					Typed Bun engine with{" "}
					<span className="bg-gradient-to-r from-amber-500 to-amber-700 bg-clip-text text-transparent">
						OAuth sessions
					</span>
					.
				</h1>
				<p className="max-w-xl text-lg leading-relaxed text-slate-600">
					Export a function, get a validated endpoint, an OpenAPI document and
					typed React Query hooks. Sign in to try the protected dashboard and
					todo list.
				</p>

				{authError && (
					<p className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
						<ShieldAlert size={16} aria-hidden />
						{AUTH_ERRORS[authError] ?? `Sign-in failed (${authError}).`}
					</p>
				)}

				{isAuthLoading ? (
					<div className="h-12 w-48 animate-pulse rounded-2xl bg-slate-100" />
				) : user ? (
					<div className="flex flex-wrap gap-4 pt-2">
						<Link
							to="/dashboard"
							className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-800"
						>
							Go to dashboard
							<ArrowRight size={16} aria-hidden />
						</Link>
						<Link
							to="/todos"
							className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-amber-500"
						>
							Manage todos
						</Link>
					</div>
				) : (
					<div className="pt-2">
						<GoogleSignInButton />
					</div>
				)}

				<div className="flex flex-wrap gap-3 pt-4">
					<a
						className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600 transition-all hover:border-slate-400 hover:bg-white"
						href={`${API_BASE_URL}/openapi.json`}
						target="_blank"
						rel="noreferrer"
					>
						<FileJson size={14} aria-hidden />
						OpenAPI spec
					</a>
					<a
						className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600 transition-all hover:border-slate-400 hover:bg-white"
						href={API_BASE_URL}
						target="_blank"
						rel="noreferrer"
					>
						<Server size={14} aria-hidden />
						Engine root
					</a>
				</div>
			</div>

			<div className="flex flex-col space-y-6 md:col-span-5">
				<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="mb-4 flex items-center gap-2 font-bold text-slate-800">
						<Activity size={18} className="text-amber-500" aria-hidden />
						<span>System health</span>
					</div>
					{health.isPending && (
						<p className="text-sm text-slate-400">Querying health endpoint…</p>
					)}
					{health.isError && (
						<p className="flex items-center gap-1.5 text-sm text-rose-500">
							<ShieldAlert size={14} aria-hidden />
							{health.error.message}
						</p>
					)}
					{health.data && (
						<dl className="grid grid-cols-2 gap-4">
							<Stat label="Status" value={health.data.status} />
							<Stat
								label="Runtime"
								value={health.data.checks?.runtime ?? "bun"}
							/>
							<Stat label="Environment" value={health.data.environment} />
							<Stat
								label="Uptime"
								value={`${Math.round(health.data.uptimeMs / 1000)}s`}
							/>
						</dl>
					)}
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="mb-4 flex items-center gap-2 font-bold text-slate-800">
						<ArrowRightLeft size={18} className="text-blue-500" aria-hidden />
						<span>Typed GET query</span>
					</div>
					<label className="mb-4 flex flex-col space-y-2">
						<span className="text-xs font-semibold text-slate-500">
							Payload
						</span>
						<input
							value={message}
							onChange={(event) => setMessage(event.target.value)}
							className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
							placeholder="Ping payload"
						/>
					</label>
					{pingPong.isError && (
						<p className="text-sm text-rose-500">{pingPong.error.message}</p>
					)}
					{pingPong.data && (
						<dl className="grid grid-cols-2 gap-4">
							<Stat label="Received" value={pingPong.data.received} />
							<Stat label="Reply" value={pingPong.data.repeated.join(" ")} />
						</dl>
					)}
				</div>
			</div>
		</section>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-xs font-semibold uppercase text-slate-400">
				{label}
			</dt>
			<dd className="mt-1 text-sm font-bold capitalize text-slate-700">
				{value}
			</dd>
		</div>
	);
}
