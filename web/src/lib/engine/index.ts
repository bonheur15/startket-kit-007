/**
 * Stable import surface for the generated engine client.
 *
 *   import { useEngine, useEngineMutation, callEngine } from "@/lib/engine";
 */

export * as api from "../../../.generated/api-client";
export * as apiHooks from "../../../.generated/api-hooks";
export {
	callEngine,
	type EngineInput,
	type EngineMethod,
	type EngineMutationPath,
	type EnginePath,
	type EngineQueryPath,
	type EngineResponse,
	engineQueryKey,
	engineRoutes,
	invalidateEngine,
	prefetchEngine,
	useEngine,
	useEngineMutation,
} from "../../../.generated/engine";
export { ApiClientError, isApiClientError } from "../api/error";
export { queryClient } from "../api/query-client";
