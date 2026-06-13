import {
	Activity,
	ArrowRight,
	ArrowRightLeft,
	FileJson,
	Lock,
	Server,
	ShieldAlert,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { API_BASE_URL } from "@/lib/api/config";
import { useAuth } from "@/lib/auth-context";
import { useEngine } from "@/lib/engine";

export default function HomePage() {
	const { user, isLoading: isAuthLoading } = useAuth();
	const [message, setMessage] = useState("ping");
	const health = useEngine("/health", { query: { verbose: true } });
	const pingPong = useEngine("/ping-pong", { query: { message, repeat: 2 } });

	const googleLoginUrl = `${API_BASE_URL}/api/auth/google/login?redirect_uri=${window.location.origin}/dashboard`;

	return (
		<section className="hero-grid grid md:grid-cols-12 gap-8 items-center py-6">
			<div className="hero-copy md:col-span-7 flex flex-col space-y-6">
				<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold w-fit animate-fade-in">
					<Sparkles size={14} className="animate-spin-slow" />
					<span>Production-Ready Framework</span>
				</div>
				<h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl leading-tight">
					Typed Bun Engine with{" "}
					<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-700">
						OAuth Security
					</span>
					.
				</h1>
				<p className="hero-text text-lg text-slate-650 leading-relaxed max-w-xl">
					StarterKit 007 handles end-to-end type safety, auto-generated RPC
					wrappers, and scalable session storage. Log in to access private
					dashboards and todo applications.
				</p>

				{isAuthLoading ? (
					<div className="w-16 h-8 bg-slate-100 animate-pulse rounded-full" />
				) : user ? (
					<div className="flex flex-wrap gap-4 pt-2">
						<Link
							to="/dashboard"
							className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-semibold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
						>
							Go to Dashboard
							<ArrowRight size={16} />
						</Link>
						<Link
							to="/todos"
							className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 hover:border-amber-500 hover:bg-amber-50/20 text-slate-700 rounded-2xl font-semibold transition-all hover:-translate-y-0.5"
						>
							Manage Tasks
						</Link>
					</div>
				) : (
					<div className="flex flex-col space-y-4 pt-2">
						<a
							href={googleLoginUrl}
							className="inline-flex items-center justify-center px-6 py-3.5 bg-white border border-slate-200 hover:border-amber-400 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl shadow-sm hover:shadow transition-all w-fit hover:-translate-y-0.5"
						>
							<svg
								className="w-5 h-5 mr-3"
								viewBox="0 0 24 24"
								fill="currentColor"
								role="img"
								aria-labelledby="google-logo-title"
							>
								<title id="google-logo-title">Google Logo</title>
								<path
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									fill="#4285F4"
								/>
								<path
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									fill="#34A853"
								/>
								<path
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
									fill="#FBBC05"
								/>
								<path
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									fill="#EA4335"
								/>
							</svg>
							Continue with Google
						</a>
						<span className="text-xs text-slate-400 flex items-center gap-1.5 pl-1">
							<Lock size={12} className="text-slate-400" />
							Secure HttpOnly multi-session storage.
						</span>
					</div>
				)}

				<div className="hero-actions flex flex-wrap gap-3 pt-4">
					<a
						className="action-link text-xs flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 hover:border-slate-400 hover:bg-white transition-all text-slate-600"
						href={`${API_BASE_URL}/openapi.json`}
						target="_blank"
						rel="noreferrer"
					>
						<FileJson size={14} />
						OpenAPI Spec
					</a>
					<a
						className="action-link text-xs flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 hover:border-slate-400 hover:bg-white transition-all text-slate-600"
						href={API_BASE_URL}
						target="_blank"
						rel="noreferrer"
					>
						<Server size={14} />
						Engine Root
					</a>
				</div>
			</div>

			<div className="status-panel md:col-span-5 flex flex-col space-y-6">
				{user && (
					<div className="p-6 bg-amber-50/40 border border-amber-200/60 rounded-3xl backdrop-blur-xl animate-fade-in">
						<div className="flex items-center gap-4">
							{user.picture && (
								<img
									src={user.picture}
									alt="User Avatar"
									className="w-12 h-12 rounded-full ring-4 ring-white object-cover shadow-sm"
									referrerPolicy="no-referrer"
								/>
							)}
							<div>
								<h3 className="font-bold text-slate-800 text-lg">
									Welcome back, {user.name}!
								</h3>
								<p className="text-xs text-slate-500">
									Authenticated successfully via Google.
								</p>
							</div>
						</div>
					</div>
				)}

				<div className="status-card p-6 bg-white border border-slate-150 rounded-3xl shadow-sm">
					<div className="status-header flex items-center gap-2 font-bold text-slate-800 mb-4">
						<Activity size={18} className="text-amber-500" />
						<span>System Health Check</span>
					</div>
					{health.isLoading && (
						<p className="status-muted text-sm text-slate-400">
							Querying health endpoint...
						</p>
					)}
					{health.isError && (
						<p className="status-error text-sm text-rose-500 flex items-center gap-1.5">
							<ShieldAlert size={14} />
							{health.error?.message}
						</p>
					)}
					{health.data && (
						<dl className="key-grid grid grid-cols-2 gap-4">
							<div>
								<dt className="text-xs text-slate-400 uppercase font-semibold">
									Status
								</dt>
								<dd className="text-sm font-bold text-slate-700 mt-1">
									{health.data.status}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-slate-400 uppercase font-semibold">
									Engine
								</dt>
								<dd className="text-sm font-bold text-slate-700 mt-1">
									{health.data.checks?.runtime ?? "Bun"}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-slate-400 uppercase font-semibold">
									Environment
								</dt>
								<dd className="text-sm font-bold text-slate-700 mt-1 capitalize">
									{health.data.environment}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-slate-400 uppercase font-semibold">
									Uptime
								</dt>
								<dd className="text-sm font-bold text-slate-700 mt-1">
									{Math.round(health.data.uptimeMs / 1000)}s
								</dd>
							</div>
						</dl>
					)}
				</div>

				<div className="status-card p-6 bg-white border border-slate-150 rounded-3xl shadow-sm">
					<div className="status-header flex items-center gap-2 font-bold text-slate-800 mb-4">
						<ArrowRightLeft size={18} className="text-blue-500" />
						<span>RPC Protocol Demonstration</span>
					</div>

					<label className="field flex flex-col space-y-2 mb-4">
						<span className="text-xs font-semibold text-slate-500">
							Payload input:
						</span>
						<input
							value={message}
							onChange={(event) => setMessage(event.target.value)}
							className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-medium"
							placeholder="Ping payload"
						/>
					</label>

					{pingPong.isLoading && (
						<p className="status-muted text-sm text-slate-400">
							Calling RPC...
						</p>
					)}
					{pingPong.isError && (
						<p className="status-error text-sm text-rose-500">
							{pingPong.error?.message}
						</p>
					)}
					{pingPong.data && (
						<dl className="key-grid grid grid-cols-2 gap-4">
							<div>
								<dt className="text-xs text-slate-400 uppercase font-semibold">
									Received
								</dt>
								<dd className="text-sm font-bold text-slate-700 mt-1">
									{pingPong.data.received}
								</dd>
							</div>
							<div>
								<dt className="text-xs text-slate-400 uppercase font-semibold">
									Reply
								</dt>
								<dd className="text-sm font-bold text-slate-700 mt-1">
									{pingPong.data.reply}
								</dd>
							</div>
						</dl>
					)}
				</div>
			</div>
		</section>
	);
}
