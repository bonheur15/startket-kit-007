import { NavLink, Outlet } from "react-router";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const tabs = [
	{ to: "/dashboard", label: "Overview", end: true },
	{ to: "/dashboard/settings", label: "Settings", end: false },
];

export default function DashboardLayout() {
	const { user } = useAuth();
	const firstName = user?.name?.split(" ")[0];

	return (
		<div className="mx-auto max-w-5xl">
			<PageHeader
				eyebrow="Account"
				title={firstName ? `Welcome back, ${firstName}` : "Dashboard"}
				description="Your profile, session and preferences. Everything here is served by protected endpoints."
			/>

			<nav
				className="mb-6 flex gap-1 border-b border-line"
				aria-label="Dashboard"
			>
				{tabs.map((tab) => (
					<NavLink
						key={tab.to}
						to={tab.to}
						end={tab.end}
						className={({ isActive }) =>
							cn(
								"-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
								isActive
									? "border-accent text-fg"
									: "border-transparent text-fg-muted hover:border-line-strong hover:text-fg",
							)
						}
					>
						{tab.label}
					</NavLink>
				))}
			</nav>

			<Outlet />
		</div>
	);
}
