SHELL := /bin/bash

.PHONY: install generate dev dev-worker dev-engine dev-web start-engine test typecheck build verify clean format lint check fix \
        db-push db-generate db-migrate db-studio worker-build

## ---- Setup --------------------------------------------------------------

install:
	bun install

## ---- Code quality -------------------------------------------------------

format:
	bun run format

lint:
	bun run lint

check:
	bun run check

fix:
	bun run check:fix

## ---- Codegen ------------------------------------------------------------

generate:
	cd engine && bun run generate

## ---- Development --------------------------------------------------------

dev-engine:
	cd engine && bun run dev

dev-web:
	cd web && bun run dev

# Full stack: generator watcher + Bun engine + Vite dev server.
dev:
	$(MAKE) generate
	trap 'kill 0' EXIT; \
	( cd engine && bun run generate:watch ) & \
	( cd engine && bun run dev:server ) & \
	( cd web && bun run dev ) & \
	wait

# Same as `dev`, but runs the engine inside the Cloudflare Workers runtime.
dev-worker:
	$(MAKE) generate
	trap 'kill 0' EXIT; \
	( cd engine && bun run generate:watch ) & \
	( cd engine && bun run worker:dev ) & \
	( cd web && VITE_API_BASE_URL=http://localhost:8787 bun run dev ) & \
	wait

start-engine:
	$(MAKE) generate
	cd engine && bun run start

## ---- Verification -------------------------------------------------------

test:
	$(MAKE) generate
	cd engine && bun test

typecheck:
	$(MAKE) generate
	cd engine && bun run typecheck
	cd web && bun run typecheck

build:
	$(MAKE) generate
	cd engine && bun run build
	cd web && bun run build

worker-build:
	$(MAKE) generate
	cd engine && bun run worker:build

verify:
	$(MAKE) check
	$(MAKE) test
	$(MAKE) typecheck
	$(MAKE) build

clean:
	rm -rf engine/dist web/dist engine/.generated web/.generated engine/.wrangler

## ---- Database -----------------------------------------------------------

# Push the schema directly (fast iteration in development).
db-push:
	cd engine && bun run db:push

# Generate a SQL migration from schema changes (commit the result).
db-generate:
	cd engine && bun run db:generate

# Apply pending migrations (use in CI/production).
db-migrate:
	cd engine && bun run db:migrate

db-studio:
	cd engine && bun run db:studio
