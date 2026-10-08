import { LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export default function DashboardSettingsPage() {
	const { logout, user } = useAuth();
	const { theme, setTheme } = useTheme();

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>Appearance</CardTitle>
					<CardDescription>Stored in this browser only.</CardDescription>
				</CardHeader>
				<CardContent className="pt-2">
					<div className="grid grid-cols-2 gap-3">
						{(
							[
								{ value: "light", label: "Light", icon: Sun },
								{ value: "dark", label: "Dark", icon: Moon },
							] as const
						).map(({ value, label, icon: Icon }) => (
							<button
								key={value}
								type="button"
								onClick={() => setTheme(value)}
								className={cn(
									"flex items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium transition-all",
									theme === value
										? "border-accent bg-accent-soft text-fg ring-2 ring-accent/30"
										: "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg",
								)}
							>
								<Icon className="size-4" aria-hidden />
								{label}
							</button>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Profile</CardTitle>
					<CardDescription>
						Synchronised from Google on every sign-in.
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-2">
					<dl className="divide-y divide-line text-sm">
						<Row label="Name" value={user?.name ?? "—"} />
						<Row label="Email" value={user?.email ?? "—"} />
						<Row label="User id" value={`#${user?.id ?? "—"}`} mono />
					</dl>
				</CardContent>
			</Card>

			<Card className="border-danger/30 lg:col-span-2">
				<CardHeader>
					<CardTitle className="text-danger">Sign out</CardTitle>
					<CardDescription>
						Revokes this session on the server immediately. Other devices stay
						signed in.
					</CardDescription>
				</CardHeader>
				<CardFooter className="justify-end border-t-0 pt-0">
					<Button variant="danger" onClick={() => void logout()}>
						<LogOut className="size-4" aria-hidden />
						Sign out of this device
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}

function Row({
	label,
	value,
	mono = false,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
			<dt className="text-fg-muted">{label}</dt>
			<dd className={cn("truncate text-fg", mono && "font-mono text-[13px]")}>
				{value}
			</dd>
		</div>
	);
}
