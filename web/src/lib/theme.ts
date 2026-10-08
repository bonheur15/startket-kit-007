import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function readTheme(): Theme {
	if (typeof document === "undefined") return "light";
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
	document.documentElement.classList.toggle("dark", theme === "dark");
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		// Storage can be unavailable (private mode); the class still applies.
	}
}

/**
 * Light/dark theme backed by a `.dark` class on <html>. The initial class is
 * set by an inline script in index.html so there is no flash on load.
 */
export function useTheme() {
	const [theme, setTheme] = useState<Theme>(readTheme);

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = (event: MediaQueryListEvent) => {
			if (localStorage.getItem(STORAGE_KEY)) return;
			const next: Theme = event.matches ? "dark" : "light";
			document.documentElement.classList.toggle("dark", next === "dark");
			setTheme(next);
		};
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);

	const set = useCallback((next: Theme) => {
		applyTheme(next);
		setTheme(next);
	}, []);

	const toggle = useCallback(
		() => set(theme === "dark" ? "light" : "dark"),
		[set, theme],
	);

	return { theme, setTheme: set, toggle };
}
