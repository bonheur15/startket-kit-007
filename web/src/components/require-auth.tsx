import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/lib/auth";
import { Spinner } from "./spinner";

/**
 * Renders children only for signed-in users. Anonymous visitors are sent to
 * `/login` and brought back to the page they wanted after signing in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
	const { user, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) return <Spinner label="Resolving session…" />;

	if (!user) {
		const redirect = `${location.pathname}${location.search}`;
		return (
			<Navigate
				to={`/login?redirect=${encodeURIComponent(redirect)}`}
				replace
			/>
		);
	}

	return <>{children}</>;
}
