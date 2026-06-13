# Architecture

## Overview

This project uses a function-first generated API system.

Source of truth:

- exported endpoint functions in `engine/src/api`

Generated outputs:

- backend runtime manifest
- backend OpenAPI document
- frontend typed API client
- frontend typed query hooks
- frontend route alias registry

## Backend Flow

1. Define an endpoint function in `engine/src/api/.../index.ts`
2. Run `make generate`
3. `engine/scripts/generate.ts` uses the TypeScript compiler API to infer:
   - method
   - path
   - input type
   - output type
4. Generated runtime artifacts are written into `engine/src/generated`
5. `engine/src/core/api/runtime.ts` serves the request using the generated manifest

## Frontend Flow

1. The same generator writes typed frontend artifacts into `web/src/generated`
2. `web/src/lib/engine/index.ts` provides the stable app-facing import surface
3. Components call:
   - `useEngine(path, input)`
   - `callEngine(path, input)`
4. `web/src/lib/api/hooks.ts` handles caching and fetch lifecycle

## Runtime Validation

The generator converts inferred TypeScript shapes into internal runtime schemas.

This means:

- no manual contract file for common cases
- runtime input parsing on the backend
- runtime response shape validation
- generated OpenAPI from the same inferred shapes

The generator supports parsing highly complex TypeScript types into strict runtime schemas, including:

- **Primitives:** `string`, `number`, `boolean`, `any`
- **Objects & Arrays:** Recursive interfaces, nested arrays, `Record<string, T>`
- **Advanced Types:** Unions (`|`), Intersections (`&`), Tuples (`[A, B]`), and literal types
- **Special Types:** `Date`

### Error Handling

Validation is strict at runtime:

- **Input Validation (400 Bad Request):** If the client sends a `query` or `body` payload that doesn't match the required schema, the runtime intercepts it before it reaches your function and returns a detailed `SchemaError` describing the mismatch.
- **Output Validation (500 Internal Server Error):** If your endpoint function accidentally returns data that doesn't match its declared return type, the runtime catches the discrepancy and returns a 500 error to ensure frontend contracts are never violated.

## Alias Strategy

Backend remains explicit and versioned:

- `/api/v1/system/health`

Frontend can use shorter typed aliases:

- `/v1/system/health`
- `/system/health`
- `/health`
