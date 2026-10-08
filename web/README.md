# Web

React 19 + Vite + Tailwind 4 + React Query. Consumes the engine through the generated client.

```bash
bun run dev         # http://localhost:5173
bun run typecheck
bun run build       # → dist/
```

Set `VITE_API_BASE_URL` in `.env` (defaults to `http://localhost:3000`).

Start here:

- `src/app/` — file-based routes ([root README → Routing](../README.md#routing-in-the-web-app))
- `src/lib/engine/` — `useEngine`, `useEngineMutation`, `callEngine` ([root README → Calling the API](../README.md#calling-the-api-from-the-web-app))
- `src/lib/auth/` — `useAuth()`, `<AuthProvider>`, `getLoginUrl()`
- `src/components/require-auth.tsx` — guard for protected routes
- `src/components/error-boundary.tsx` — route error UI

React Query Devtools are mounted in development (bottom-left).
