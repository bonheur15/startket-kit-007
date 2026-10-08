import {
	BookOpen,
	FileJson,
	LayoutDashboard,
	ListTodo,
	LogOut,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Brand } from "@/components/brand";
import { RouteErrorBoundary } from "@/components/error-boundary";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api/config";
import { AuthProvider, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export { RouteErrorBoundary as ErrorBoundary };

const publicLinks = [
	{ to: "/about", label: "How it works" },
	{ to: "/health", label: "Status" },
];

function NavItem({
	to,
	children,
	icon,
}: {
	to: string;
	children: React.ReactNode;
	icon?: React.ReactNode;
}) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				cn(
					"inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
					isActive
						? "bg-ink-3 text-ink-fg"
						: "text-ink-muted hover:bg-ink-3/60 hover:text-ink-fg",
				)
			}
		>
			{icon}
			<span className={icon ? "hidden sm:inline" : undefined}>{children}</span>
		</NavLink>
	);
}

function UserMenu() {
	const { user, isLoading, logout } = useAuth();
	const location = useLocation();

	if (isLoading)
		return <div className="h-8 w-24 animate-pulse rounded-lg bg-ink-3" />;

	if (!user) {
		return (
			<Button asChild variant="accent" size="sm">
				<Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`}>
					Sign in
				</Link>
			</Button>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<Link
				to="/dashboard"
				className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-ink-3/60"
			>
				{user.picture ? (
					<img
						src={user.picture}
						alt=""
						className="size-7 rounded-md object-cover ring-1 ring-ink-line"
						referrerPolicy="no-referrer"
					/>
				) : (
					<span className="flex size-7 items-center justify-center rounded-md bg-accent font-mono text-xs font-bold text-accent-fg">
						{(user.name ?? user.email).charAt(0).toUpperCase()}
					</span>
				)}
				<span className="hidden text-[13px] font-medium text-ink-fg lg:inline">
					{user.name ?? user.email}
				</span>
			</Link>
			<button
				type="button"
				onClick={() => void logout()}
				className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-danger/15 hover:text-danger"
				title="Sign out"
			>
				<LogOut className="size-4" aria-hidden />
				<span className="sr-only">Sign out</span>
			</button>
		</div>
	);
}

function Header() {
	const { user } = useAuth();

	return (
		<header className="sticky top-0 z-50 border-b border-ink-line bg-ink/90 text-ink-fg backdrop-blur-xl">
			<div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
				<div className="flex items-center gap-6">
					<Brand inverted />
					<nav
						className="hidden items-center gap-0.5 md:flex"
						aria-label="Primary"
					>
						{publicLinks.map((link) => (
							<NavItem key={link.to} to={link.to}>
								{link.label}
							</NavItem>
						))}
						{user && (
							<>
								<span className="mx-1 h-4 w-px bg-ink-line" />
								<NavItem
									to="/todos"
									icon={<ListTodo className="size-3.5" aria-hidden />}
								>
									Todos
								</NavItem>
								<NavItem
									to="/dashboard"
									icon={<LayoutDashboard className="size-3.5" aria-hidden />}
								>
									Dashboard
								</NavItem>
							</>
						)}
					</nav>
				</div>

				<div className="flex items-center gap-2">
					<a
						href={`${API_BASE_URL}/openapi.json`}
						target="_blank"
						rel="noreferrer"
						className="hidden h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-xs text-ink-muted transition-colors hover:bg-ink-3/60 hover:text-ink-fg sm:inline-flex"
					>
						<FileJson className="size-3.5" aria-hidden />
						openapi.json
					</a>
					<ThemeToggle />
					<UserMenu />
				</div>
			</div>

			{/* Mobile nav */}
			<nav
				className="flex gap-1 overflow-x-auto border-t border-ink-line px-3 py-2 md:hidden"
				aria-label="Mobile"
			>
				{publicLinks.map((link) => (
					<NavItem key={link.to} to={link.to}>
						{link.label}
					</NavItem>
				))}
				{user && (
					<>
						<NavItem to="/todos">Todos</NavItem>
						<NavItem to="/dashboard">Dashboard</NavItem>
					</>
				)}
			</nav>
		</header>
	);
}

function Footer() {
	return (
		<footer className="border-t border-line">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<p className="font-mono text-xs">
					StarterKit 007 · Bun · React · Drizzle ·{" "}
					<span className="text-fg-subtle">function-first RPC</span>
				</p>
				<div className="flex items-center gap-5 text-xs">
					<Link
						to="/about"
						className="inline-flex items-center gap-1.5 hover:text-fg"
					>
						<BookOpen className="size-3.5" aria-hidden />
						Docs
					</Link>
					<a
						href={`${API_BASE_URL}/openapi.json`}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1.5 hover:text-fg"
					>
						<FileJson className="size-3.5" aria-hidden />
						OpenAPI
					</a>
					<Link to="/health" className="hover:text-fg">
						Status
					</Link>
				</div>
			</div>
		</footer>
	);
}

export default function RootLayout() {
	return (
		<AuthProvider>
			<div className="flex min-h-screen flex-col">
				<Header />
				<main className="mx-auto w-full max-w-7xl flex-grow px-4 py-10 sm:px-6">
					<Outlet />
				</main>
				<Footer />
			</div>
		</AuthProvider>
	);
}
