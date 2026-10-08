import {
	type QueryKey,
	type UseMutationOptions,
	type UseMutationResult,
	type UseQueryOptions,
	type UseQueryResult,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	apiRequest,
	type EndpointInput,
	type EndpointMeta,
	type RequestOptions,
} from "./client";
import type { ApiClientError } from "./error";
import { queryClient } from "./query-client";

/** Query key for an endpoint + input: `["engine", "/api/v1/todos", { query: ... } | null]`. */
export function apiQueryKey(endpoint: EndpointMeta, input?: EndpointInput) {
	return ["engine", endpoint.path, input ?? null] as const;
}

export type ApiQueryOptions<TData> = Omit<
	UseQueryOptions<TData, ApiClientError, TData, QueryKey>,
	"queryKey" | "queryFn"
> & {
	/** Options forwarded to the HTTP request (debug, timeout, headers). */
	request?: Omit<RequestOptions, "signal">;
};

export type ApiQueryResult<TData> = UseQueryResult<TData, ApiClientError> & {
	/** Drop the cached data for this query and refetch if mounted. */
	invalidate: () => Promise<void>;
};

export function useApiQuery<TData>(
	endpoint: EndpointMeta,
	input?: EndpointInput,
	options: ApiQueryOptions<TData> = {},
): ApiQueryResult<TData> {
	const client = useQueryClient();
	const queryKey = apiQueryKey(endpoint, input);
	const { request, ...queryOptions } = options;

	const query = useQuery<TData, ApiClientError, TData, QueryKey>({
		...queryOptions,
		queryKey,
		queryFn: ({ signal }) =>
			apiRequest<TData>(endpoint, input, { ...request, signal }),
	});

	return {
		...query,
		invalidate: () => client.invalidateQueries({ queryKey }),
	};
}

export type ApiMutationOptions<TData, TVariables, TContext = unknown> = Omit<
	UseMutationOptions<TData, ApiClientError, TVariables, TContext>,
	"mutationFn"
> & {
	/** Endpoint metadata whose cached queries are invalidated after success. */
	invalidates?: readonly EndpointMeta[];
	request?: RequestOptions;
};

export type ApiMutationResult<
	TData,
	TVariables,
	TContext = unknown,
> = UseMutationResult<TData, ApiClientError, TVariables, TContext>;

export function useApiMutation<TData, TVariables, TContext = unknown>(
	endpoint: EndpointMeta,
	toInput: (variables: TVariables) => EndpointInput | undefined,
	options: ApiMutationOptions<TData, TVariables, TContext> = {},
): ApiMutationResult<TData, TVariables, TContext> {
	const { invalidates, request, onSuccess, ...mutationOptions } = options;

	return useMutation<TData, ApiClientError, TVariables, TContext>({
		...mutationOptions,
		mutationKey: ["engine", endpoint.path],
		mutationFn: (variables) =>
			apiRequest<TData>(endpoint, toInput(variables), request),
		async onSuccess(data, variables, onMutateResult, context) {
			if (invalidates) {
				await Promise.all(invalidates.map((meta) => invalidateApi(meta)));
			}
			await onSuccess?.(data, variables, onMutateResult, context);
		},
	});
}

/** Invalidate every cached query for an endpoint, regardless of input. */
export function invalidateApi(endpoint: EndpointMeta): Promise<void> {
	return queryClient.invalidateQueries({ queryKey: ["engine", endpoint.path] });
}

export function prefetchApi<TData>(
	endpoint: EndpointMeta,
	input?: EndpointInput,
	options: ApiQueryOptions<TData> = {},
): Promise<void> {
	const { request, staleTime } = options;
	return queryClient.prefetchQuery({
		queryKey: apiQueryKey(endpoint, input),
		queryFn: ({ signal }) =>
			apiRequest<TData>(endpoint, input, { ...request, signal }),
		staleTime,
	});
}
