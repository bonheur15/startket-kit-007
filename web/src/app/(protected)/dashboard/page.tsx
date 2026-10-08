import { Clock, Mail, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function DashboardPage() {
	const { user } = useAuth();
	if (!user) return null;

	const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-bold text-slate-800">Account overview</h2>
				<p className="text-sm text-slate-400">
					Profile information synchronised from Google.
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<div className="flex flex-col space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
					<div className="flex items-center gap-4">
						{user.picture ? (
							<img
								src={user.picture}
								alt=""
								className="h-16 w-16 rounded-full object-cover shadow-sm ring-4 ring-white"
								referrerPolicy="no-referrer"
							/>
						) : (
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl font-bold text-amber-600">
								{(user.name ?? user.email).charAt(0).toUpperCase()}
							</div>
						)}
						<div>
							<h3 className="text-lg font-bold text-slate-800">
								{user.name ?? "Unnamed"}
							</h3>
							<p className="text-xs text-slate-400">
								Member since {memberSince}
							</p>
						</div>
					</div>
					<div className="space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
						<div className="flex items-center gap-2">
							<Mail className="h-4 w-4 text-slate-400" aria-hidden />
							<span>{user.email}</span>
						</div>
						<div className="flex items-center gap-2">
							<Shield className="h-4 w-4 text-emerald-500" aria-hidden />
							<span className="font-medium">Google account linked</span>
						</div>
					</div>
				</div>

				<div className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
					<div className="space-y-2">
						<h3 className="flex items-center gap-1.5 font-bold text-slate-800">
							<Clock className="h-4 w-4 text-amber-500" aria-hidden />
							Active session
						</h3>
						<p className="text-xs leading-relaxed text-slate-500">
							Sessions are stored hashed in the database, extended automatically
							while you are active, and can be revoked individually or all at
							once.
						</p>
					</div>
					<div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
						<span>Cookie-based, HttpOnly</span>
						<span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
							Active
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
