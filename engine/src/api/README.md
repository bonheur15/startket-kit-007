# Endpoint DX

Define an endpoint as a plain exported function:

```ts
export function getExample(input?: { name?: string }) {
  return {
    message: `hello ${input?.name ?? "world"}`,
  };
}
```

Rules:

- Export one function
- Keep one endpoint per folder
- Method is inferred from the function name
- Run `make generate` after adding or changing endpoints
