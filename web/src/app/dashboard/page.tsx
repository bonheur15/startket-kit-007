import { Clock, Mail, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
	const { user } = useAuth();

	if (!user) return null;

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-xl font-bold text-slate-805">Account Overview</h3>
				<p className="text-sm text-slate-400">
					View your active profile information synchronized via Google OAuth.
				</p>
			</div>

			<div className="grid md:grid-cols-2 gap-6">
				{/* Profile Card */}
				<div className="flex flex-col p-6 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-4">
					<div className="flex items-center gap-4">
						{user.picture ? (
							<img
								src={user.picture}
								alt={user.name || "Avatar"}
								className="w-16 h-16 rounded-full object-cover ring-4 ring-white shadow-sm"
								referrerPolicy="no-referrer"
							/>
						) : (
							<div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-2xl">
								{user.name?.charAt(0) || user.email.charAt(0)}
							</div>
						)}
						<div>
							<h4 className="font-bold text-slate-800 text-lg">
								{user.name || "N/A"}
							</h4>
							<p className="text-xs text-slate-450">Registered User</p>
						</div>
					</div>

					<div className="border-t border-slate-100 pt-4 space-y-2">
						<div className="flex items-center gap-2 text-sm text-slate-600">
							<Mail className="w-4 h-4 text-slate-400" />
							<span>{user.email}</span>
						</div>
						<div className="flex items-center gap-2 text-sm text-slate-600">
							<Shield className="w-4 h-4 text-emerald-500" />
							<span className="font-medium">
								Active Security: AuthJS Multi-Account Schema
							</span>
						</div>
					</div>
				</div>

				{/* Session Card */}
				<div className="flex flex-col p-6 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-4 justify-between">
					<div className="space-y-2">
						<h4 className="font-bold text-slate-800 flex items-center gap-1.5">
							<Clock className="w-4 h-4 text-amber-500" />
							Active Session
						</h4>
						<p className="text-xs text-slate-500 leading-relaxed">
							Your current session is verified against a database-backed session
							table. This allows multiple active devices and secure, revocable
							token invalidation.
						</p>
					</div>

					<div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-450">
						<span>
							Session Protocol: <b>v1</b> (Persistent)
						</span>
						<span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
							Active
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
