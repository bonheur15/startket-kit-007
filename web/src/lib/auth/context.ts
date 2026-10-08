import { createContext, useContext } from "react";
import type { GetAuthMeResponse } from "../../../.generated/api-client";

export type User = GetAuthMeResponse;

export type AuthContextValue = {
	/** `undefined` while the session is being resolved, `null` when anonymous. */
	user: User | null | undefined;
	isLoading: boolean;
	isAuthenticated: boolean;
	/** Re-fetch the session (e.g. after a profile update). */
	refresh: () => Promise<void>;
	logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
	undefined,
);

export function useAuth(): AuthContextValue {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used within <AuthProvider>");
	return context;
}
