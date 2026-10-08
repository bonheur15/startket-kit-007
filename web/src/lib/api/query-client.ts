import { QueryClient } from "@tanstack/react-query";
import { isApiClientError } from "./error";

/**
 * Shared React Query client. Tune defaults here, not per call site.
 *
 * - 4xx responses are never retried (they will not succeed on retry).
 * - Data is considered fresh for 30 seconds, then refetched in the background.
 */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			gcTime: 5 * 60_000,
			refetchOnWindowFocus: true,
			retry(failureCount, error) {
				if (
					isApiClientError(error) &&
					error.status >= 400 &&
					error.status < 500
				)
					return false;
				return failureCount < 2;
			},
		},
		mutations: {
			retry: false,
		},
	},
});
