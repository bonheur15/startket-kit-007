import {
	ArrowUpRight,
	Clock,
	KeyRound,
	ListTodo,
	Mail,
	ShieldCheck,
} from "lucide-react";
import { Link } from "react-router";
import { StatusDot } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useEngine } from "@/lib/engine";

export default function DashboardPage() {
	const { user } = useAuth();
	const todos = useEngine("/todos");

	if (!user) return null;

	const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	const open = todos.data?.filter((t) => !t.completed).length ?? 0;
	const done = todos.data?.filter((t) => t.completed).length ?? 0;

	return (
		<div className="grid gap-6 lg:grid-cols-3">
			<Card className="lg:col-span-2">
				<CardContent className="p-6 sm:p-8">
					<div className="flex flex-col gap-6 sm:flex-row sm:items-center">
						{user.picture ? (
							<img
								src={user.picture}
								alt=""
								className="size-20 rounded-2xl object-cover shadow-md ring-2 ring-accent/40"
								referrerPolicy="no-referrer"
							/>
						) : (
							<div className="flex size-20 items-center justify-center rounded-2xl bg-accent font-mono text-3xl font-bold text-accent-fg">
								{(user.name ?? user.email).charAt(0).toUpperCase()}
							</div>
						)}
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h2 className="truncate text-2xl font-semibold tracking-tight text-fg">
									{user.name ?? "Unnamed"}
								</h2>
								<Badge variant="accent">
									<StatusDot pulse />
									signed in
								</Badge>
							</div>
							<p className="mt-1 flex items-center gap-1.5 text-sm text-fg-muted">
								<Mail className="size-3.5" aria-hidden />
								{user.email}
							</p>
							<p className="mt-1 font-mono text-xs text-fg-subtle">
								user #{user.id} · member since {memberSince}
							</p>
						</div>
					</div>

					<dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
						<Metric
							label="Open todos"
							value={todos.isPending ? "…" : String(open)}
						/>
						<Metric
							label="Completed"
							value={todos.isPending ? "…" : String(done)}
						/>
						<Metric label="Provider" value="Google" />
						<Metric label="Session" value="Active" />
					</dl>
				</CardContent>
			</Card>

			<Card className="bg-ink text-ink-fg">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ShieldCheck className="size-4 text-accent" aria-hidden />
						Security
					</CardTitle>
					<CardDescription className="text-ink-muted">
						How your session is protected.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4 pt-2 text-sm">
					<Item
						icon={KeyRound}
						title="Hashed token"
						body="Only a SHA-256 hash of your session is stored."
					/>
					<Item
						icon={Clock}
						title="Sliding expiry"
						body="Extended automatically while you are active."
					/>
					<Button
						asChild
						size="sm"
						variant="soft"
						className="mt-2 bg-ink-3 text-ink-fg hover:bg-ink-line"
					>
						<Link to="/dashboard/settings">
							Manage session
							<ArrowUpRight className="size-3.5" aria-hidden />
						</Link>
					</Button>
				</CardContent>
			</Card>

			<Card className="lg:col-span-3">
				<CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
					<div className="flex items-center gap-4">
						<span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:text-accent">
							<ListTodo className="size-5" aria-hidden />
						</span>
						<div>
							<h3 className="font-semibold text-fg">Todo demo</h3>
							<p className="text-sm text-fg-muted">
								Four generated endpoints, optimistic updates, cache
								invalidation.
							</p>
						</div>
					</div>
					<Button asChild variant="accent">
						<Link to="/todos">Open todos</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-surface px-4 py-4">
			<dt className="font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
				{label}
			</dt>
			<dd className="tabular mt-1 text-xl font-semibold text-fg">{value}</dd>
		</div>
	);
}

function Item({
	icon: Icon,
	title,
	body,
}: {
	icon: typeof Clock;
	title: string;
	body: string;
}) {
	return (
		<div className="flex items-start gap-3">
			<Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
			<div>
				<p className="font-medium text-ink-fg">{title}</p>
				<p className="text-xs text-ink-muted">{body}</p>
			</div>
		</div>
	);
}
