# Architecture

## Request lifecycle (engine)

```
Request
  │  resolve request id (client-provided only if well-formed)
  │  build RequestContext { request, url, requestId, logger, responseHeaders, user() }
  ▼
rawFetch()  ──► Response?   (last-resort escape hatch)
  ▼
rawRoutes   ──► exact / :param match → handler(context, params)
  ▼
OPTIONS → 204 + CORS      "/" → service info      "/openapi.json" → document
  ▼
RPC routes  (generated manifest)
  │  match path (trailing slash tolerated) → 404
  │  match method (HEAD ⇒ GET)             → 405 + Allow
  │  read input: path params + query | JSON body (type, size, parse checks)
  │  inputSchema.parse()                   → 400 { issues }
  │  handler(input)                        (ApiError → its status; other → 500, logged)
  │  responseSchema.parse()                → 500 (configurable)
  ▼
Envelope { ok, data | error, meta: { requestId, timestamp } }
  + CORS (allow-list), security headers, Set-Cookie from context.responseHeaders
  + one structured log line per request
```

The context is stored in `AsyncLocalStorage`, so `requireAuth()`, `getUser()` and `getRequestContext()` work anywhere in the call stack without passing a request object around. The user is resolved **lazily** on first use and memoised for the request.

## Generator

`engine/scripts/generate.ts` loads `engine/tsconfig.json`, creates a TypeScript program over `src/api/**/index.ts` and, for each file:

1. Finds the single exported function (type exports are allowed; anything else is an error).
2. Infers method (name prefix), path (folder), path params (`[name]` folders), and whether the input is optional.
3. Converts the input and return types into an intermediate representation, which is then printed twice:
   - as runtime schema expressions (`s.object({...})`) for validation and OpenAPI,
   - as TypeScript type text for the web client (`Date` → `string` in responses).
4. Reads the JSDoc comment (`summary`, description, `@tag`, `@deprecated`) and detects `requireAuth(` for OpenAPI security.
5. Rejects duplicates (method + path, function names), recursive types, `any`/`unknown`, functions, and unknown method prefixes.

Outputs are only rewritten when their content changes, so the watcher does not trigger needless reloads.

### Supported types

Primitives, literals, string-literal unions (enums), `Date`, arrays, tuples, `Record<string, T>`, nested objects, intersections, `| null`, `| undefined` / optional properties, `void` returns.

## Web client

```
web/.generated/api-client.ts   per-operation functions + Meta objects (method, path, inputSource)
web/.generated/api-hooks.ts    per-operation React Query hooks
web/.generated/engine.ts       path-based API: useEngine / useEngineMutation / callEngine / invalidateEngine
web/src/lib/api/client.ts      fetch wrapper: path params, query/body encoding, envelopes, timeouts, errors
web/src/lib/api/hooks.ts       thin adapters over @tanstack/react-query
web/src/lib/api/query-client   shared QueryClient (retry policy, stale times)
```

Query keys are `["engine", <canonical path>, <input | null>]`, so every alias of an endpoint shares one cache entry and `invalidateEngine(path)` invalidates all inputs of that endpoint.

## Alias strategy

Backend paths are explicit and versioned (`/api/v1/system/health`). The web client additionally accepts `/v1/system/health`, `/system/health` and, for `system/*`, `/health`. All aliases resolve to the same metadata object.

## Database

`engine/src/db/index.ts` exports a lazy `db` handle. The driver is chosen from `DATABASE_URL`:

- host ends in `.neon.tech` (or `DATABASE_DRIVER=neon`) → `@neondatabase/serverless` over HTTP (required on Workers)
- otherwise → `postgres.js` over TCP

No connection is opened until the first query, so codegen, tests and the Workers bundle do not need a database.

## Sessions

- Token: `session_<64 hex>`; only its SHA-256 hash is stored.
- TTL from `SESSION_TTL_DAYS`; extended when less than half the TTL remains.
- Cookie attributes (`SameSite`, `Secure`, `Domain`) come from the environment so the same code works for same-site and cross-site deployments.
- Expired sessions are deleted on access; the Worker `scheduled` handler (and `cleanExpiredSessions()`) sweeps the rest.

## Testing

`engine/test/helpers.ts` installs a deterministic environment. Runtime, CORS, schema, env and OAuth behaviour are tested without a database; `app.test.ts` exercises the generated manifest. Add endpoint tests next to the endpoint (`index.test.ts`) and use `useTestEnv()`.
