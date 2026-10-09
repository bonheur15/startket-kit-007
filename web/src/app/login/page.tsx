import { KeyRound, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { Navigate, useSearchParams } from "react-router";
import { BrandMark } from "@/components/brand";
import { GoogleSignInButton } from "@/components/google-button";
import { Spinner } from "@/components/spinner";
import { useAuth } from "@/lib/auth";

function safeRedirect(value: string | null): string {
	return value?.startsWith("/") && !value.startsWith("//")
		? value
		: "/dashboard";
}

const POINTS = [
	{ icon: Lock, text: "HttpOnly cookie, never readable from JavaScript" },
	{ icon: KeyRound, text: "PKCE + state check on every sign-in" },
	{ icon: RefreshCw, text: "Sessions extend while you are active" },
	{ icon: ShieldCheck, text: "Revocable per device, or everywhere at once" },
];

export default function LoginPage() {
	const { user, isLoading } = useAuth();
	const [searchParams] = useSearchParams();
	const redirectTo = safeRedirect(searchParams.get("redirect"));

	if (isLoading) return <Spinner label="Resolving session" />;
	if (user) return <Navigate to={redirectTo} replace />;

	return (
		<section className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-line bg-surface shadow-lg md:grid-cols-5">
			<div className="bg-grid-ink relative hidden flex-col justify-between bg-ink p-8 text-ink-fg md:col-span-2 md:flex">
				<BrandMark className="size-9 text-xs" />
				<div>
					<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
						Sessions
					</p>
					<h2 className="mt-2 text-xl font-semibold leading-snug">
						Stored in the database, hashed, and scoped to this engine.
					</h2>
					<ul className="mt-6 space-y-3 text-sm text-ink-muted">
						{POINTS.map(({ icon: Icon, text }) => (
							<li key={text} className="flex items-start gap-2.5">
								<Icon
									className="mt-0.5 size-4 shrink-0 text-accent"
									aria-hidden
								/>
								{text}
							</li>
						))}
					</ul>
				</div>
				<p className="pt-8 font-mono text-[11px] text-ink-muted">
					engine · /api/auth/google
				</p>
			</div>

			<div className="flex flex-col items-center justify-center p-8 text-center sm:p-12 md:col-span-3">
				<h1 className="text-2xl font-semibold tracking-tight text-fg">
					Sign in to continue
				</h1>
				<p className="mt-2 max-w-sm text-sm text-fg-muted">
					You will be returned to{" "}
					<code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-fg">
						{redirectTo}
					</code>{" "}
					after signing in.
				</p>
				<div className="mt-8">
					<GoogleSignInButton redirectTo={redirectTo} />
				</div>
				<p className="mt-8 max-w-xs text-xs leading-relaxed text-fg-subtle">
					Only your Google account id, email, name and avatar are stored. No
					password is ever created.
				</p>
			</div>
		</section>
	);
}
