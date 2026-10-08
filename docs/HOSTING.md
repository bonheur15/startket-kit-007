# Hosting

The engine and the web app deploy separately. The engine runs on **Bun** (any VM/container) or **Cloudflare Workers**; the web app is a static bundle (Cloudflare Pages, Netlify, S3, …).

## 1. Decide on cookie strategy (read this first)

The session is an HttpOnly cookie set by the engine. Browsers only send it back to the web app's requests if the cookie policy allows it:

| Web and engine on … | Example | Setting |
| --- | --- | --- |
| the same registrable domain | `app.example.com` + `api.example.com` | `COOKIE_SAME_SITE=lax`, optional `COOKIE_DOMAIN=.example.com` |
| different sites | `x.pages.dev` + `y.workers.dev` | `COOKIE_SAME_SITE=none` (requires HTTPS; `COOKIE_SECURE` is forced on) |

With `SameSite=None`, third-party cookie restrictions in some browsers (Safari ITP, Chrome's phase-out) may block the session. A custom domain for both is the robust setup.

`CORS_ORIGINS` must list the web app's origin exactly (wildcards like `https://*.pages.dev` are allowed for previews). A wildcard `*` is rejected in production.

## 2. Engine on Cloudflare Workers

`engine/wrangler.toml` already points at `src/worker.ts`. Fill in the non-secret vars there (`WEB_URL`, `API_URL`, `CORS_ORIGINS`, `COOKIE_SAME_SITE`) and set the secrets:

```bash
cd engine
wrangler secret put DATABASE_URL          # a Neon URL (HTTP driver) or any Postgres reachable from Workers
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
bun run worker:deploy
```

Register `${API_URL}/api/auth/google/callback` as an authorized redirect URI in Google Cloud.

To sweep expired sessions, enable a cron trigger:

```toml
[triggers]
crons = ["0 3 * * *"]
```

`make worker-build` (`wrangler deploy --dry-run`) verifies the bundle compiles; CI runs it on every PR.

## 3. Engine on Bun (VM, Docker, Fly, Railway, …)

```bash
cd engine
bun install --production
bun run build                 # → dist/index.js
NODE_ENV=production bun dist/index.js
```

Required environment: `DATABASE_URL`, `API_URL`, `WEB_URL`, `CORS_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, plus `COOKIE_SAME_SITE` per the table above. `PORT` defaults to 3000. The process handles `SIGTERM` for graceful shutdown.

## 4. Web

```bash
cd web
VITE_API_BASE_URL=https://api.example.com bun run build   # → web/dist
```

Deploy `web/dist` as static files with SPA fallback to `index.html` (Cloudflare Pages does this automatically).

## 5. Database migrations

Development: `make db-push` applies the schema directly.

Production: generate migrations from schema changes and commit them, then apply in CI before deploying:

```bash
make db-generate      # writes engine/drizzle/*.sql
make db-migrate       # applies pending migrations using DATABASE_URL
```

The engine deploy workflow runs `db:migrate` automatically when the `DATABASE_URL` secret is configured.

## 6. GitHub Actions

| Workflow | Trigger | Does |
| --- | --- | --- |
| `ci.yml` | every PR, pushes to `main` | `make check`, tests, typecheck, engine + worker + web builds |
| `deploy-engine.yml` | push to `main` touching `engine/**` | migrations + `wrangler deploy` |
| `deploy-web.yml` | push to `main` touching `web/**` or API sources | build + `wrangler pages deploy` |

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
Variables: `VITE_API_BASE_URL`, optionally `CLOUDFLARE_PAGES_PROJECT`.

## 7. Checklist

1. Engine reachable: `GET ${API_URL}/api/v1/system/health?verbose=true`
2. OpenAPI served: `GET ${API_URL}/openapi.json`
3. CORS: a request from the web origin returns `access-control-allow-origin` with that origin
4. Sign in with Google lands on `${WEB_URL}/dashboard` with a `session` cookie
5. `GET /api/v1/auth/me` from the web app returns the profile (cookie policy is correct)
6. Logs are JSON (`LOG_FORMAT=json`) and include `requestId`
