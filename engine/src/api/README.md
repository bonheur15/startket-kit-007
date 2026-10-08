# Endpoints

One folder = one endpoint. Export exactly one function from `index.ts`:

```ts
// src/api/v1/todos/create/index.ts
import { requireAuth } from "../../../../core/auth/require-auth";

/**
 * Create a todo for the signed-in user.
 * Longer description goes here and ends up in the OpenAPI document.
 */
export async function createTodo(input: { title: string }) {
  const user = await requireAuth();
  // ...
  return { id: 1, title: input.title, completed: false };
}
```

Rules enforced by the generator (`make generate`):

| Rule | Why |
| --- | --- |
| Exactly one exported function per `index.ts` | One route per folder keeps `useEngine("/todos/create")` unambiguous. |
| Function name starts with `get`/`list`/`find`/`search`/`fetch` → `GET`, `create`/`post`/`add` → `POST`, `update`/`put` → `PUT`, `patch`/`edit` → `PATCH`, `delete`/`remove` → `DELETE` | The HTTP method is inferred from the name; unknown prefixes are an error. |
| Input is the first parameter and must be an object type (or omitted) | `GET`/`DELETE` read it from the query string, other methods from the JSON body. |
| `[param]` folders become path parameters and are merged into the input | `todos/[id]/update` → `/api/v1/todos/:id/update` with `input.id`. Type it as `number` to get coercion for free. |
| No `any` / `unknown` in inputs or outputs | The runtime validates both directions from the inferred types. |
| `Date` in a response is sent as an ISO string | The generated client types reflect the wire format (`string`). |

Helpers available inside a handler:

- `requireAuth()` — returns the user or throws `401`
- `getUser()` — returns the user or `null`
- `getRequestContext()` — request id, URL, logger, response headers
- `errors.notFound()`, `errors.forbidden()`, ... — structured errors
