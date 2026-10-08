import { useAuth } from "@/lib/auth";

export default function DashboardSettingsPage() {
	const { logout } = useAuth();

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-bold text-slate-800">Settings</h2>
				<p className="text-sm text-slate-400">
					This page lives at{" "}
					<code>src/app/(protected)/dashboard/settings/page.tsx</code>.
				</p>
			</div>
			<div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6">
				<h3 className="font-bold text-slate-800">Sign out</h3>
				<p className="mt-1 text-sm text-slate-500">
					Revokes this session on the server.
				</p>
				<button
					type="button"
					onClick={() => void logout()}
					className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
				>
					Sign out
				</button>
			</div>
		</div>
	);
}
