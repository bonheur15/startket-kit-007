import { useEffect, useSyncExternalStore } from "react";
import type { EndpointMeta } from "./client";
import { apiRequest } from "./client";
import type { ApiClientError } from "./error";

export type QueryOptions<TData> = {
	enabled?: boolean;
	staleTime?: number;
	initialData?: TData;
	debug?: boolean;
};

type QueryStatus = "idle" | "loading" | "success" | "error";

type QueryRecord<TData> = {
	status: QueryStatus;
	data?: TData;
	error?: ApiClientError;
	updatedAt: number;
	promise?: Promise<TData>;
};

const records = new Map<string, QueryRecord<unknown>>();
const listeners = new Map<string, Set<() => void>>();

function stableSerialize(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
	}

	return `{${Object.keys(value)
		.sort()
		.map(
			(key) =>
				`${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`,
		)
		.join(",")}}`;
}

function buildKey<TInput>(endpoint: EndpointMeta, input?: TInput): string {
	return [
		endpoint.operationId,
		endpoint.method,
		endpoint.path,
		stableSerialize(input ?? null),
	].join("|");
}

function getRecord<TData>(
	key: string,
	initialData?: TData,
): QueryRecord<TData> {
	if (!records.has(key)) {
		records.set(key, {
			status: initialData !== undefined ? "success" : "idle",
			data: initialData,
			error: undefined,
			updatedAt: initialData !== undefined ? Date.now() : 0,
		});
	}

	return records.get(key) as QueryRecord<TData>;
}

function emit(key: string): void {
	const listenersForKey = listeners.get(key);
	if (listenersForKey) {
		for (const listener of listenersForKey) {
			listener();
		}
	}
}

function subscribe(key: string, listener: () => void): () => void {
	const bucket = listeners.get(key) ?? new Set<() => void>();
	bucket.add(listener);
	listeners.set(key, bucket);

	return () => {
		const existing = listeners.get(key);

		if (!existing) {
			return;
		}

		existing.delete(listener);

		if (existing.size === 0) {
			listeners.delete(key);
		}
	};
}

function shouldRefetch(
	record: QueryRecord<unknown>,
	staleTime: number,
): boolean {
	if (record.status === "idle" || record.status === "error") {
		return true;
	}

	return Date.now() - record.updatedAt > staleTime;
}

async function executeQuery<TData, TInput>(
	key: string,
	endpoint: EndpointMeta,
	input?: TInput,
	options?: QueryOptions<TData>,
): Promise<TData> {
	const record = getRecord<TData>(key);

	if (record.promise) {
		return record.promise;
	}

	const promise = apiRequest<TData, TInput>(endpoint, input, options)
		.then((data) => {
			records.set(key, {
				status: "success",
				data,
				error: undefined,
				updatedAt: Date.now(),
			});
			emit(key);
			return data;
		})
		.catch((error: ApiClientError) => {
			records.set(key, {
				status: "error",
				data: record.data,
				error,
				updatedAt: Date.now(),
			});
			emit(key);
			throw error;
		});

	records.set(key, {
		...record,
		status: record.data !== undefined ? "success" : "loading",
		promise,
	});
	emit(key);

	try {
		return await promise;
	} finally {
		const latest = getRecord<TData>(key);

		if (latest.promise) {
			records.set(key, {
				...latest,
				promise: undefined,
			});
		}
	}
}

export function invalidateQuery(key: string): void {
	records.delete(key);
	emit(key);
}

export async function prefetchQuery<TData, TInput>(
	endpoint: EndpointMeta,
	input?: TInput,
	options?: QueryOptions<TData>,
): Promise<TData> {
	const key = buildKey(endpoint, input);
	return executeQuery<TData, TInput>(key, endpoint, input, options);
}

export type UseApiQueryResult<TData> = {
	key: string;
	isFetching: boolean;
	refetch: () => Promise<TData>;
	invalidate: () => void;
	updatedAt: number;
} & (
	| {
			status: "idle";
			isIdle: true;
			isLoading: false;
			isSuccess: false;
			isError: false;
			data: undefined;
			error: undefined;
	  }
	| {
			status: "loading";
			isIdle: false;
			isLoading: true;
			isSuccess: false;
			isError: false;
			data: undefined;
			error: undefined;
	  }
	| {
			status: "success";
			isIdle: false;
			isLoading: false;
			isSuccess: true;
			isError: false;
			data: TData;
			error: undefined;
	  }
	| {
			status: "error";
			isIdle: false;
			isLoading: false;
			isSuccess: false;
			isError: true;
			data: TData | undefined;
			error: ApiClientError;
	  }
);

export function useApiQuery<TData, TInput>(
	endpoint: EndpointMeta,
	input?: TInput,
	options: QueryOptions<TData> = {},
): UseApiQueryResult<TData> {
	const key = buildKey(endpoint, input);
	const enabled = options.enabled ?? true;
	const staleTime = options.staleTime ?? 10_000;
	const record = useSyncExternalStore(
		(listener) => subscribe(key, listener),
		() => getRecord<TData>(key, options.initialData),
		() => getRecord<TData>(key, options.initialData),
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: key represents input natively
	useEffect(() => {
		const currentRecord = getRecord<TData>(key, options.initialData);

		if (!enabled || !shouldRefetch(currentRecord, staleTime)) {
			return;
		}

		void executeQuery<TData, TInput>(key, endpoint, input, options);
	}, [enabled, endpoint, key, staleTime]);

	return {
		...record,
		key,
		isIdle: record.status === "idle",
		isLoading: record.status === "loading",
		isFetching: record.promise !== undefined,
		isSuccess: record.status === "success",
		isError: record.status === "error",
		refetch: () => executeQuery<TData, TInput>(key, endpoint, input, options),
		invalidate: () => {
			invalidateQuery(key);
			void executeQuery<TData, TInput>(key, endpoint, input, options);
		},
	} as UseApiQueryResult<TData>;
}
