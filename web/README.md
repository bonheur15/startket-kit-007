# Web

Frontend application for Starterkit 007.

Main docs:

- [Root README](../README.md)
- [Architecture](../docs/ARCHITECTURE.md)
- [Hosting](../docs/HOSTING.md)

## Purpose

`web/` is a Vite + React app that consumes the backend through the generated engine client.

Use:

```ts
import { useEngine, callEngine } from "@/lib/engine";
```

Examples:

```ts
const health = useEngine("/system/health", { verbose: true });
const ping = useEngine("/ping-pong", { message: "hello", repeat: 2 });
```

## Environment

```env
VITE_API_BASE_URL=http://127.0.0.1:3000
```

## Commands

```bash
bun run dev
bun run typecheck
bun run build
```
