import type { ComponentType } from "react";
import { Outlet, type RouteObject } from "react-router";

type RouteModule = {
	default?: ComponentType;
	Component?: ComponentType;
	ErrorBoundary?: ComponentType;
	loader?: RouteObject["loader"];
	action?: RouteObject["action"];
	handle?: unknown;
};

type RouteImporter = () => Promise<RouteModule>;

type RouteNode = {
	folderName: string;
	pathSegment?: string;
	page?: RouteImporter;
	layout?: RouteImporter;
	children: Map<string, RouteNode>;
};

const routeModules = import.meta.glob<RouteModule>([
	"../app/page.tsx",
	"../app/layout.tsx",
	"../app/**/page.tsx",
	"../app/**/layout.tsx",
	"../app/not-found.tsx",
]);

function OutletRoute() {
	return <Outlet />;
}

/** Shown while the first lazy route module loads. */
function HydrateFallback() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-canvas">
			<div className="size-6 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
		</div>
	);
}

function createNode(folderName: string): RouteNode {
	return {
		folderName,
		pathSegment: folderToPathSegment(folderName),
		children: new Map(),
	};
}

function folderToPathSegment(folderName: string): string | undefined {
	// Route groups: src/app/(marketing)/about/page.tsx -> /about
	if (folderName.startsWith("(") && folderName.endsWith(")")) {
		return undefined;
	}

	// Dynamic folders: src/app/users/[id]/page.tsx -> /users/:id
	if (folderName.startsWith("[") && folderName.endsWith("]")) {
		const param = folderName.slice(1, -1);

		// Catch-all folders: src/app/docs/[...slug]/page.tsx -> /docs/*
		if (param.startsWith("...")) {
			return "*";
		}

		return `:${param}`;
	}

	return folderName;
}

function lazyRoute(importer: RouteImporter) {
	return async () => {
		const mod = await importer();
		const Component = mod.Component ?? mod.default;

		if (!Component) {
			throw new Error(
				"Route modules must export a default component or a named Component.",
			);
		}

		const route: Record<string, unknown> = {
			Component,
		};

		if (mod.ErrorBoundary) route.ErrorBoundary = mod.ErrorBoundary;
		if (mod.loader) route.loader = mod.loader;
		if (mod.action) route.action = mod.action;
		if (mod.handle) route.handle = mod.handle;

		return route;
	};
}

function insertRouteFile(
	root: RouteNode,
	filePath: string,
	importer: RouteImporter,
) {
	const relativePath = filePath.replace("../app/", "");

	if (relativePath === "not-found.tsx") {
		return;
	}

	const parts = relativePath.split("/");
	const fileName = parts.pop();

	let node = root;

	for (const folderName of parts) {
		const existing = node.children.get(folderName);
		const child = existing ?? createNode(folderName);

		if (!existing) {
			node.children.set(folderName, child);
		}

		node = child;
	}

	if (fileName === "page.tsx") {
		node.page = importer;
	}

	if (fileName === "layout.tsx") {
		node.layout = importer;
	}
}

function getSortedChildren(node: RouteNode) {
	return Array.from(node.children.values()).sort((a, b) => {
		return getSortScore(a.pathSegment) - getSortScore(b.pathSegment);
	});
}

function getSortScore(pathSegment?: string) {
	if (!pathSegment) return 0;
	if (pathSegment === "*") return 3;
	if (pathSegment.startsWith(":")) return 2;
	return 1;
}

function buildChildRoutes(node: RouteNode): RouteObject[] {
	const routes: RouteObject[] = [];

	for (const child of getSortedChildren(node)) {
		const childRoutes = buildChildRoutes(child);

		if (child.page) {
			childRoutes.unshift({
				index: true,
				lazy: lazyRoute(child.page),
			});
		}

		const route: RouteObject = {
			Component: child.layout ? undefined : OutletRoute,
			children: childRoutes.length > 0 ? childRoutes : undefined,
		};

		if (child.pathSegment) {
			route.path = child.pathSegment;
		}

		if (child.layout) {
			route.lazy = lazyRoute(child.layout);
		}

		routes.push(route);
	}

	return routes;
}

export function createFileRoutes(): RouteObject[] {
	const root = createNode("");
	let notFoundImporter: RouteImporter | undefined;

	for (const [filePath, importer] of Object.entries(routeModules)) {
		if (filePath.endsWith("/not-found.tsx")) {
			notFoundImporter = importer;
			continue;
		}

		insertRouteFile(root, filePath, importer);
	}

	const rootChildren = buildChildRoutes(root);

	if (root.page) {
		rootChildren.unshift({
			index: true,
			lazy: lazyRoute(root.page),
		});
	}

	if (notFoundImporter) {
		rootChildren.push({
			path: "*",
			lazy: lazyRoute(notFoundImporter),
		});
	}

	return [
		{
			path: "/",
			Component: root.layout ? undefined : OutletRoute,
			lazy: root.layout ? lazyRoute(root.layout) : undefined,
			HydrateFallback,
			children: rootChildren,
		},
	];
}
