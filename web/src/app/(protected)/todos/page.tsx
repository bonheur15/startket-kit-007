import { PageHeader } from "@/components/page-header";
import { TodoApp } from "@/components/todo-app";
import { Badge } from "@/components/ui/badge";

const ENDPOINTS = [
	{ method: "GET", path: "/todos", variant: "accent" },
	{ method: "POST", path: "/todos/create", variant: "info" },
	{ method: "PUT", path: "/todos/:id/update", variant: "info" },
	{ method: "DELETE", path: "/todos/:id/delete", variant: "danger" },
] as const;

export default function TodosPage() {
	return (
		<div className="mx-auto max-w-3xl">
			<PageHeader
				eyebrow="Demo"
				title="Todos"
				description="A full read/write loop through generated endpoints with optimistic updates and cache invalidation. Double-click a task to rename it."
				className="mb-5"
			/>
			<div className="mb-6 flex flex-wrap items-center gap-2">
				<span className="font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
					endpoints
				</span>
				{ENDPOINTS.map((endpoint) => (
					<Badge key={endpoint.path} variant={endpoint.variant} className="normal-case tracking-normal">
						<span className="font-bold">{endpoint.method}</span>
						<span className="font-mono font-medium">{endpoint.path}</span>
					</Badge>
				))}
			</div>
			<TodoApp />
		</div>
	);
}
