import type React from "react";
import { createContext, useContext } from "react";
import { callEngine, useEngine } from "@/lib/engine";

export type User = {
	id: number;
	email: string;
	name: string | null;
	picture: string | null;
};

type AuthContextType = {
	user: User | null;
	isLoading: boolean;
	logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const { data, isLoading, invalidate } = useEngine(
		"/api/v1/auth/me",
		undefined,
		{
			staleTime: 60 * 1000,
		},
	);

	const user = data ?? null;

	const logout = async () => {
		try {
			await callEngine("/api/v1/auth/logout", { body: {} });
		} catch (error) {
			console.error("Logout request failed:", error);
		} finally {
			invalidate();
			window.location.href = "/";
		}
	};

	return (
		<AuthContext.Provider value={{ user, isLoading, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
