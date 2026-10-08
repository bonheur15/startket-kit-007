import { Lock } from "lucide-react";
import { Navigate, useSearchParams } from "react-router";
import { GoogleSignInButton } from "@/components/google-button";
import { Spinner } from "@/components/spinner";
import { useAuth } from "@/lib/auth";

function safeRedirect(value: string | null): string {
	return value?.startsWith("/") && !value.startsWith("//")
		? value
		: "/dashboard";
}

export default function LoginPage() {
	const { user, isLoading } = useAuth();
	const [searchParams] = useSearchParams();
	const redirectTo = safeRedirect(searchParams.get("redirect"));

	if (isLoading) return <Spinner label="Resolving session…" />;
	if (user) return <Navigate to={redirectTo} replace />;

	return (
		<section className="mx-auto flex max-w-md flex-col items-center gap-6 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
			<div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
				<Lock size={24} aria-hidden />
			</div>
			<div>
				<h1 className="text-2xl font-extrabold text-slate-900">Sign in</h1>
				<p className="mt-2 text-sm text-slate-500">
					Sessions are stored server-side in an HttpOnly cookie. Sign in with
					Google to continue to{" "}
					<span className="font-mono text-slate-700">{redirectTo}</span>.
				</p>
			</div>
			<GoogleSignInButton redirectTo={redirectTo} />
		</section>
	);
}
