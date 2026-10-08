# StarterKit 007

A full-stack TypeScript starter: a **function-first API engine** on Bun (or Cloudflare Workers) and a **React 19 + Vite** frontend, wired together by a code generator so the API contract is typed end to end.

```
export function createTodo(input: { title: string }) { ... }
            │
            ▼  make generate
  ┌─────────────────────────────┬────────────────────────────────────┐
  │ engine/.generated           │ web/.generated                     │
  │  endpoints.ts  (validation) │  engine.ts  useEngine / mutations  │
  │  openapi-document.ts        │  api-client.ts  typed functions    │
  └─────────────────────────────┴────────────────────────────────────┘
            │
            ▼
  POST /api/v1/todos/create   →   useEngineMutation("/todos/create")
```

## Highlights

- **Write a function, get an endpoint.** Method from the name, path from the folder, input/output validated at runtime from the inferred TypeScript types, OpenAPI 3.1 generated.
- **Typed React Query hooks.** `useEngine` for reads, `useEngineMutation` for writes, cache invalidation by path, optimistic updates, devtools.
- **Database-backed Google OAuth.** PKCE + state cookie, hashed session tokens, sliding expiry, redirect allow-listing.
- **Runs on Bun or Cloudflare Workers** from the same code; Postgres via `postgres.js` (TCP) or Neon (HTTP).
- **Production hygiene built in.** Validated env, structured logs, CORS allow-list, body limits, security headers, request ids, error envelopes.
- **One toolchain.** Bun workspaces, Biome for lint + format, `make verify` runs everything CI runs.

## Quick start

Requirements: [Bun](https://bun.sh) ≥ 1.2, Docker (optional, for Postgres).

```bash
make install                      # bun install for all workspaces
cp engine/.env.example engine/.env
cp web/.env.example web/.env
docker compose up -d              # local Postgres on :5432
make db-push                      # create tables
make dev                          # generator watcher + engine + web
```

- Web: http://localhost:5173
- Engine: http://localhost:3000
- OpenAPI: http://localhost:3000/openapi.json

Google sign-in needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `engine/.env`, with `http://localhost:3000/api/auth/google/callback` registered as an authorized redirect URI. Everything else works without them.

## Everyday commands

| Command | What it does |
| --- | --- |
| `make dev` | Full stack with the generator in watch mode |
| `make dev-worker` | Same, but the engine runs in the Workers runtime (`wrangler dev`) |
| `make generate` | Regenerate endpoints, OpenAPI, and the web client |
| `make check` / `make fix` | Biome lint + format (check / apply) |
| `make test` | Engine test suite |
| `make typecheck` | Both workspaces |
| `make verify` | check + test + typecheck + build (what CI runs) |
| `make db-push` | Push the schema to the database (development) |
| `make db-generate` / `make db-migrate` | Create / apply SQL migrations (production) |
| `make db-studio` | Drizzle Studio |

## Project layout

```
engine/
  src/api/            ← your endpoints (one folder = one endpoint)
  src/core/api/       ← runtime, request context, errors, OpenAPI
  src/core/auth/      ← sessions, requireAuth, Google OAuth routes
  src/core/http/      ← cookies, CORS
  src/core/schema/    ← runtime validation primitives
  src/config/env.ts   ← validated environment
  src/db/             ← drizzle schema + driver selection
  src/app.ts          ← assembles endpoints + raw routes
  src/index.ts        ← Bun entry       src/worker.ts ← Workers entry
  scripts/generate.ts ← the generator
web/
  src/app/            ← file-based routes (page.tsx / layout.tsx / (groups) / [params])
  src/lib/engine/     ← stable import surface for the generated client
  src/lib/api/        ← fetch client, React Query hooks, query client
  src/lib/auth/       ← AuthProvider, useAuth, login URL
  src/components/     ← RequireAuth, ErrorBoundary, UI
docs/                 ← architecture + hosting
```

## Writing an endpoint

Create `engine/src/api/v1/<resource>/<action>/index.ts` and export **one** function:

```ts
import { requireAuth } from "../../../../core/auth/require-auth";
import { errors } from "../../../../core/api/error";

/**
 * Rename a project.                      ← becomes the OpenAPI summary
 * Only the owner may rename it.          ← becomes the description
 * @tag projects
 */
export async function updateProject(input: { id: number; name: string }) {
  const user = await requireAuth();                 // 401 if anonymous
  const project = await findProject(input.id);
  if (!project) throw errors.notFound("Project not found");
  if (project.ownerId !== user.id) throw errors.forbidden();
  return rename(project, input.name);               // return type is validated too
}
```

- Folder `v1/projects/[id]/rename/` + `updateProject` ⇒ `PUT /api/v1/projects/:id/rename`
- `[id]` path params are merged into `input` and coerced to the declared type (`number` here).
- Name prefixes: `get|list|find|search|fetch` → GET, `create|post|add` → POST, `update|put` → PUT, `patch|edit` → PATCH, `delete|remove` → DELETE. Anything else is a generator error.
- GET/DELETE inputs come from the query string, others from the JSON body.
- `Date` values are sent as ISO strings; the generated client types say `string`.
- Unknown input keys are stripped; `any`/`unknown` are rejected by the generator.

Inside a handler you also have `getUser()` (nullable), `getRequestContext()` (request id, logger, response headers) and the `errors` helpers.

### Things that are not JSON function calls

OAuth redirects, webhooks, file uploads and streaming live in **raw routes** (`engine/src/app.ts`), which still get the request context, CORS and error envelopes:

```ts
rawRoutes: [
  ...googleAuthRoutes,
  {
    method: "POST",
    pattern: "/api/webhooks/:provider",
    async handler(context, params) {
      const payload = await context.request.text();
      return Response.json({ ok: true, provider: params.provider });
    },
  },
],
```

## Calling the API from the web app

```ts
import { useEngine, useEngineMutation, callEngine, invalidateEngine } from "@/lib/engine";

// Reads (GET only). Returns a React Query result plus `invalidate()`.
const todos = useEngine("/todos");
const health = useEngine("/health", { query: { verbose: true } }, { refetchInterval: 5_000 });

// Writes (POST/PUT/PATCH/DELETE). Returns a React Query mutation.
const create = useEngineMutation("/todos/create", {
  onSuccess: () => invalidateEngine("/todos"),
});
create.mutate({ body: { title: "Ship it" } });

const remove = useEngineMutation("/todos/:id/delete");
remove.mutate({ query: { id: 42 } });              // path params are filled from the input

// Imperative
const me = await callEngine("/auth/me");
```

Paths accept any alias: `/api/v1/todos`, `/v1/todos`, `/todos` are the same endpoint; `/system/health` is also `/health`. The method is enforced at the type level: passing a POST path to `useEngine` is a compile error, as is `{ body }` on a GET.

Per-operation functions and hooks are generated too:

```ts
import { api, apiHooks } from "@/lib/engine";
await api.createTodo({ title: "x" });
const { data } = apiHooks.useGetTodosQuery();
```

Errors are `ApiClientError` instances with `status`, `code`, `requestId`, and `issues` (validation messages).

## Routing in the web app

`web/src/app/` is scanned at build time:

| File | Route |
| --- | --- |
| `page.tsx` | `/` |
| `about/page.tsx` | `/about` |
| `users/[id]/page.tsx` | `/users/:id` |
| `docs/[...slug]/page.tsx` | `/docs/*` |
| `(protected)/todos/page.tsx` | `/todos` (group folders do not affect the URL) |
| `layout.tsx` | wraps every route below it (`<Outlet />`) |
| `not-found.tsx` | 404 |

A route module may also export `ErrorBoundary`, `loader`, `action` and `handle`. Everything under `(protected)/` is wrapped in `<RequireAuth>`, which sends anonymous visitors to `/login?redirect=…`.

## Authentication

1. `/api/auth/google/login?redirect=/dashboard` stores a random `state` + PKCE verifier in a short-lived HttpOnly cookie and redirects to Google.
2. `/api/auth/google/callback` verifies the state, exchanges the code, upserts `users` / `accounts`, creates a session and sets the `session` cookie.
3. Every request resolves the user lazily on first `requireAuth()` / `getUser()`; public endpoints never touch the database.
4. Sessions are stored as SHA-256 hashes, expire after `SESSION_TTL_DAYS`, and are extended while active. `createAuthLogout` revokes the current one; `invalidateUserSessions(userId)` revokes all.

Only redirects to `WEB_URL` or an origin in `CORS_ORIGINS` are honoured.

## Environment

See `engine/.env.example` and `web/.env.example`; every variable is validated at boot and problems are reported together. The important ones:

| Variable | Purpose |
| --- | --- |
| `API_URL`, `WEB_URL` | Public URLs; used for OAuth callback and redirects |
| `CORS_ORIGINS` | Comma-separated allow-list (`https://*.example.com` works). Never `*` in production |
| `COOKIE_SAME_SITE` | `lax` when web and API share a site, `none` when they do not (requires HTTPS) |
| `DATABASE_URL` | Neon URLs use the HTTP driver automatically; anything else uses postgres.js |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `LOG_LEVEL`, `LOG_FORMAT` | `pretty` in dev, `json` in prod |
| `VALIDATE_RESPONSES` | Turn off to skip output validation in hot paths |
| `MAX_BODY_BYTES` | JSON body limit (default 1 MiB) |

## Deployment

See [docs/HOSTING.md](docs/HOSTING.md). In short: `make worker-build` proves the Workers bundle compiles, `.github/workflows/ci.yml` runs `make verify` on every PR, and the deploy workflows ship the engine (Workers) and web (Pages) from `main`.

## Conventions

- Keep endpoint-specific logic next to the endpoint. Share code through `engine/src/core` only when two endpoints need it.
- Never edit `.generated/` or `openapi.json`; run `make generate`.
- Prefer `useEngine` / `useEngineMutation` over `fetch`. The type system is the API documentation.
- Throw `ApiError` (via `errors.*`) for expected failures. Anything else is logged with a stack and returned as a generic 500.
