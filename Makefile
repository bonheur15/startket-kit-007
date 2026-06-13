SHELL := /bin/bash

.PHONY: install generate dev dev-worker dev-engine dev-web start-engine test typecheck build verify clean format lint check push

install:
	bun install
	cd engine && bun install
	cd web && bun install

format:
	bun run format

lint:
	bun run lint

check:
	bun run check

generate:
	cd engine && bun run generate

dev-engine:
	cd engine && bun run dev

dev-web:
	cd web && bun run dev

dev:
	$(MAKE) generate
	trap 'kill 0' EXIT; \
	( cd engine && bun run generate:watch ) & \
	( cd engine && bun --watch src/index.ts ) & \
	( cd web && bun run dev ) & \
	wait

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

verify:
	$(MAKE) check
	$(MAKE) test
	$(MAKE) typecheck
	$(MAKE) build

clean:
	rm -rf engine/dist

push:
	cd engine && bun run db:push
