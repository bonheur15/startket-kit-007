# Hosting

## Deployment Model

This project is designed for separate deployment of backend and frontend.

- `engine`: Bun API server
- `web`: static frontend

## Backend Deployment

### Required environment

```env
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=https://your-frontend-domain.com
APP_NAME=starterkit-engine
NODE_ENV=production
```

### Build and run

```bash
cd engine
bun run generate
bun run build
bun run start
```

Or from the repo root:

```bash
make build
make start-engine
```

## Frontend Deployment

### Required environment

```env
VITE_API_BASE_URL=https://api.your-domain.com
```

### Build

```bash
cd web
bun run build
```

Deploy `web/dist` to your static host.

## Common Modes

### Local frontend -> local backend

```env
VITE_API_BASE_URL=http://127.0.0.1:3000
```

### Local frontend -> hosted backend

```env
VITE_API_BASE_URL=https://api.your-domain.com
```

### Hosted frontend -> hosted backend

```env
VITE_API_BASE_URL=https://api.your-domain.com
```

## Production Checklist

1. Deploy backend
2. Verify `/openapi.json`
3. Verify `/api/v1/system/health`
4. Set frontend `VITE_API_BASE_URL`
5. Deploy frontend
6. Verify frontend can call `useEngine("/system/health")`
7. Verify CORS is correct
