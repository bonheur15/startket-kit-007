import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useMemo } from "react";
import { api, isApiClientError } from "@/lib/engine";
import { AuthContext, type AuthContextValue, type User } from "./context";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

async function fetchCurrentUser(): Promise<User | null> {
	try {
		return await api.getAuthMe();
	} catch (error) {
		if (isApiClientError(error) && error.isUnauthorized) return null;
		throw error;
	}
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: AUTH_QUERY_KEY,
		queryFn: fetchCurrentUser,
		staleTime: 60_000,
		retry: false,
	});

	const refresh = useCallback(async () => {
		await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
	}, [queryClient]);

	const logout = useCallback(async () => {
		try {
			await api.createAuthLogout();
		} catch (error) {
			console.warn("Logout request failed; clearing local state anyway", error);
		}
		queryClient.setQueryData(AUTH_QUERY_KEY, null);
		// Drop every cached engine response that may contain user-specific data.
		await queryClient.resetQueries({ queryKey: ["engine"] });
	}, [queryClient]);

	const value = useMemo<AuthContextValue>(
		() => ({
			user: query.data,
			isLoading: query.isPending,
			isAuthenticated: !!query.data,
			refresh,
			logout,
		}),
		[query.data, query.isPending, refresh, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
