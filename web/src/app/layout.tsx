import {
	CheckSquare,
	Info,
	LayoutDashboard,
	LogOut,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { RouteErrorBoundary } from "@/components/error-boundary";
import { API_BASE_URL } from "@/lib/api/config";
import { AuthProvider, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export { RouteErrorBoundary as ErrorBoundary };

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				cn(
					"flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
					isActive
						? "bg-slate-900 text-white"
						: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
				)
			}
		>
			{children}
		</NavLink>
	);
}

function Header() {
	const { user, isLoading, logout } = useAuth();
	const location = useLocation();

	return (
		<header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-slate-100 bg-white/80 px-6 py-3 shadow-sm backdrop-blur-xl">
			<Link
				to="/"
				className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900"
			>
				<Sparkles className="h-5 w-5 text-amber-500" aria-hidden />
				<span>StarterKit 007</span>
			</Link>

			<nav className="flex items-center gap-1" aria-label="Primary">
				<NavItem to="/about">
					<Info className="h-4 w-4" aria-hidden />
					<span className="hidden sm:inline">About</span>
				</NavItem>
				<NavItem to="/health">
					<ShieldCheck className="h-4 w-4" aria-hidden />
					<span className="hidden sm:inline">Health</span>
				</NavItem>
				{user && (
					<>
						<NavItem to="/todos">
							<CheckSquare className="h-4 w-4" aria-hidden />
							<span>Todos</span>
						</NavItem>
						<NavItem to="/dashboard">
							<LayoutDashboard className="h-4 w-4" aria-hidden />
							<span>Dashboard</span>
						</NavItem>
					</>
				)}
				<a
					href={`${API_BASE_URL}/openapi.json`}
					target="_blank"
					rel="noreferrer"
					className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:flex"
				>
					OpenAPI
				</a>
			</nav>

			<div className="flex items-center gap-3 border-l border-slate-200 pl-3">
				{isLoading ? (
					<div className="h-8 w-20 animate-pulse rounded-full bg-slate-100" />
				) : user ? (
					<>
						{user.picture && (
							<img
								src={user.picture}
								alt=""
								className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-100"
								referrerPolicy="no-referrer"
							/>
						)}
						<div className="hidden flex-col text-left lg:flex">
							<span className="text-sm font-semibold leading-tight text-slate-700">
								{user.name}
							</span>
							<span className="text-xs text-slate-400">{user.email}</span>
						</div>
						<button
							type="button"
							onClick={() => void logout()}
							className="rounded-xl p-2 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600"
							title="Sign out"
						>
							<LogOut className="h-4 w-4" aria-hidden />
							<span className="sr-only">Sign out</span>
						</button>
					</>
				) : (
					<Link
						to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
						className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
					>
						Sign in
					</Link>
				)}
			</div>
		</header>
	);
}

export default function RootLayout() {
	return (
		<AuthProvider>
			<div className="flex min-h-screen flex-col bg-slate-50/50">
				<Header />
				<main className="mx-auto w-full max-w-7xl flex-grow px-4 py-8 sm:px-6 lg:px-8">
					<Outlet />
				</main>
			</div>
		</AuthProvider>
	);
}
