import { Outlet } from "react-router";
import { RequireAuth } from "@/components/require-auth";

/**
 * Every route inside `src/app/(protected)/` requires a signed-in user.
 * Route groups in parentheses do not affect the URL.
 */
export default function ProtectedLayout() {
	return (
		<RequireAuth>
			<Outlet />
		</RequireAuth>
	);
}
