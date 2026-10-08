import { NavLink, Outlet } from "react-router";
import { cn } from "@/lib/utils";

const tabs = [
	{ to: "/dashboard", label: "Overview", end: true },
	{ to: "/dashboard/settings", label: "Settings", end: false },
];

export default function DashboardLayout() {
	return (
		<section>
			<h1 className="mb-1 text-3xl font-extrabold tracking-tight text-slate-800">
				Dashboard
			</h1>
			<p className="mb-6 text-sm font-medium text-slate-400">
				Manage your profile and active session.
			</p>

			<nav className="mb-6 flex gap-2" aria-label="Dashboard">
				{tabs.map((tab) => (
					<NavLink
						key={tab.to}
						to={tab.to}
						end={tab.end}
						className={({ isActive }) =>
							cn(
								"rounded-xl border px-4 py-2 text-sm font-semibold transition-all",
								isActive
									? "border-slate-900 bg-slate-900 text-white"
									: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
							)
						}
					>
						{tab.label}
					</NavLink>
				))}
			</nav>

			<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
				<Outlet />
			</div>
		</section>
	);
}
