# StarterKit 007

Welcome to **StarterKit 007** — a world-class, production-ready full-stack framework built with **Bun**, **React**, and **Tailwind CSS**.

This starter kit is designed for developers who want uncompromising performance, strict type safety, and an incredible Developer Experience (DX) out of the box.

---

## The Architecture

At the core of this starter kit is a custom, highly-optimized **Function-First RPC API Layer**.

### The Engine (Backend)

The backend (`engine/`) runs on [Bun](https://bun.sh/) and uses a custom `runtime.ts` that automatically turns your plain TypeScript functions into fully typed REST endpoints. No need to write manual Express/Hono controllers or deal with req/res objects for standard business logic.

### The Web (Frontend)

The frontend (`web/`) is a React SPA built with Vite. It features a custom **File-Based Router** and deeply integrates with the backend via a generated React Query wrapper (`useEngine`).

### The Bridge (Auto-Generation)

When you run `make generate`, an AST (Abstract Syntax Tree) parser scans your engine's `src/api` folder and generates strict TypeScript definitions, an OpenAPI spec, and an API client for the frontend. All auto-generated files are hidden away in `.generated/` folders so your `src/` stays pristine.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed locally.

### Installation

```bash
bun install
```

### Development

Start the full stack (API + Frontend + AST Watcher):

```bash
make dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- OpenAPI Docs: `http://localhost:3000/openapi.json`

### Code Quality

Format, lint, and typecheck your code using [Biome](https://biomejs.dev/) and TypeScript:

```bash
make check
make format
```

---

## Core Concepts

### 1. Function-First API

To create a new endpoint, simply export a function from `engine/src/api/`.

```typescript
// engine/src/api/v1/system/ping.ts
export function getSystemPing(input?: { verbose?: boolean }) {
  return { status: "ok" };
}
```

The generator intelligently assigns HTTP methods based on your function name prefixes:

- `get...` ➔ `GET`
- `post...` / `create...` ➔ `POST`
- `put...` / `update...` ➔ `PUT`
- `delete...` / `remove...` ➔ `DELETE`

### 2. Strict Client Typings (Query vs Body)

On the frontend, calling the API is strictly typed based on the HTTP method to prevent standard REST mistakes:

**For GET Requests:**
You must wrap your payload in a `query` object.

```typescript
import { useEngine } from "@/lib/engine";

// ✅ Correct
const data = useEngine("/system/ping", { query: { verbose: true } });

// ❌ TypeScript Error! (Cannot pass body to GET request)
const data = useEngine("/system/ping", { body: { verbose: true } });
```

**For POST/PUT Requests:**
You must wrap your payload in a `body` object.

```typescript
// ✅ Correct
const data = useEngine("/users/create", { body: { name: "Alice" } });
```

### 3. File-Based Routing

The frontend includes a custom file-based router. Create files inside `web/src/app/` and they automatically become routes!

- `web/src/app/page.tsx` ➔ `/`
- `web/src/app/health/page.tsx` ➔ `/health`
- `web/src/app/users/[id]/page.tsx` ➔ `/users/:id`

---

## Advanced Usage (Escape Hatches)

What if you need to build something that doesn't fit the RPC model, like **File Uploads**, **Stripe Webhooks**, or **WebSockets**?

You can bypass the auto-generator and access the underlying Bun server directly using the `rawFetch` escape hatch in `engine/src/app.ts`.

> [!WARNING]
> **Avoid Custom/Raw Endpoints for Standard Logic**: It is highly unadvisable to use custom/raw endpoints (`rawFetch`) for regular API development. Bypassing the generator completely disables end-to-end type safety, automated OpenAPI documentation, and React Query wrappers. Always use the proper, function-first RPC model that this framework was made to be used with, reserving `rawFetch` strictly for special cases like multi-part file uploads or third-party webhooks.

```typescript
// engine/src/app.ts
export function createApp() {
  return createRuntime({
    endpoints: [...endpoints],
    // The escape hatch for custom logic
    rawFetch: async (request) => {
      const url = new URL(request.url);

      if (request.method === "POST" && url.pathname === "/api/upload") {
        // You have full access to standard Web APIs here!
        const formData = await request.formData();
        return new Response("Uploaded!", { status: 200 });
      }

      // Return undefined to let the auto-generated RPC router handle everything else
      return undefined;
    },
  });
}
```

---

## Best Practices

1. **Keep `src/` Clean**: Never manually edit files inside `engine/.generated/` or `web/.generated/`. They are overwritten on every `make generate`.
2. **Organization**: any special logic for a route or api should be kept in same folder as the route or api itself, same with web, no global functions that are not even used other places, always keep it local.
3. **Strict Validation & Advanced Types**: Your API functions should rely on standard TypeScript types for inputs. The generator will automatically convert them into internal schemas for runtime validation, protecting against invalid inputs (returning `400 Bad Request`). We fully support highly complex types out of the box, including:
   - Nested Objects, Arrays, and `Record<string, unknown>`
   - Unions (`|`), Intersections (`&`), and Tuples
   - Dates and Literals
4. **Use `useEngine`**: Always use the generated `useEngine` hook instead of standard `fetch` on the frontend for instant Type-Safety and React Query caching.

---

\_Built with coffee
