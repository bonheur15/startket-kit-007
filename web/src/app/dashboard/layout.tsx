import { Loader2 } from "lucide-react";
import { Link, Navigate, Outlet } from "react-router";
import { useAuth } from "@/lib/auth-context";

export default function DashboardLayout() {
	const { user, isLoading } = useAuth();

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[400px]">
				<Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
				<p className="text-sm text-slate-400 mt-2 font-medium">
					Resolving session...
				</p>
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/" replace />;
	}

	return (
		<section className="animate-fade-in">
			<h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
				Dashboard
			</h1>
			<p className="text-sm text-slate-400 mb-6 font-medium">
				Manage your active sessions and profile integration.
			</p>

			<nav className="subnav flex gap-2 mb-6">
				<Link
					to="/dashboard"
					className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-705 text-sm font-semibold rounded-xl transition-all"
				>
					Overview
				</Link>
				<Link
					to="/dashboard/settings"
					className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-705 text-sm font-semibold rounded-xl transition-all"
				>
					Settings
				</Link>
			</nav>

			<div className="panel p-6 bg-white border border-slate-150 rounded-3xl shadow-sm">
				<Outlet />
			</div>
		</section>
	);
}
