import {
	CheckSquare,
	Info,
	LayoutDashboard,
	LogOut,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { Link, Outlet } from "react-router";
import { API_BASE_URL } from "@/lib/api/config";
import { AuthProvider, useAuth } from "@/lib/auth-context";

function InnerLayout() {
	const { user, logout } = useAuth();

	return (
		<div className="app-shell min-h-screen flex flex-col bg-slate-50/50">
			<header className="site-header sticky top-0 z-50 flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
				<Link
					to="/"
					className="brand flex items-center gap-2 text-xl font-extrabold text-slate-850 tracking-tight hover:opacity-90 transition-opacity"
				>
					<Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
					<span>StarterKit 007</span>
				</Link>

				<nav className="nav-links flex items-center gap-1 sm:gap-2">
					<Link
						to="/about"
						className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
					>
						<Info className="w-4 h-4" />
						<span className="hidden sm:inline">About</span>
					</Link>
					<Link
						to="/health"
						className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
					>
						<ShieldCheck className="w-4 h-4" />
						<span className="hidden sm:inline">Health</span>
					</Link>

					{user && (
						<>
							<Link
								to="/todos"
								className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
							>
								<CheckSquare className="w-4 h-4 text-amber-500" />
								<span>Todos</span>
							</Link>
							<Link
								to="/dashboard"
								className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
							>
								<LayoutDashboard className="w-4 h-4 text-blue-500" />
								<span>Dashboard</span>
							</Link>
						</>
					)}

					<a
						href={`${API_BASE_URL}/openapi.json`}
						target="_blank"
						rel="noreferrer"
						className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
					>
						<span>OpenAPI</span>
					</a>
				</nav>

				<div className="flex items-center gap-3">
					{user ? (
						<div className="flex items-center gap-3 pl-3 border-l border-slate-200">
							{user.picture && (
								<img
									src={user.picture}
									alt={user.name || "User avatar"}
									className="w-8 h-8 rounded-full ring-2 ring-slate-100 object-cover shadow-sm"
									referrerPolicy="no-referrer"
								/>
							)}
							<div className="hidden lg:flex flex-col text-left">
								<span className="text-sm font-semibold text-slate-700 leading-tight">
									{user.name}
								</span>
								<span className="text-xs text-slate-400">{user.email}</span>
							</div>
							<button
								onClick={logout}
								className="flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer border-none bg-transparent"
								title="Sign Out"
								type="button"
							>
								<LogOut className="w-4.5 h-4.5" />
							</button>
						</div>
					) : (
						<div className="pl-3 border-l border-slate-200">
							<a
								href={`${API_BASE_URL}/api/auth/google/login?redirect_uri=${window.location.origin}/dashboard`}
								className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-sm hover:shadow"
							>
								Sign In
							</a>
						</div>
					)}
				</div>
			</header>

			<main className="page flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<Outlet />
			</main>
		</div>
	);
}

export default function RootLayout() {
	return (
		<AuthProvider>
			<InnerLayout />
		</AuthProvider>
	);
}
