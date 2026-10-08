import { Check, Inbox, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	type EngineResponse,
	engineQueryKey,
	queryClient,
	useEngine,
	useEngineMutation,
} from "@/lib/engine";
import { cn } from "@/lib/utils";

type Todo = EngineResponse<"/todos">[number];
type Filter = "all" | "open" | "done";

const TODOS_KEY = engineQueryKey("/todos");

function patchTodos(update: (todos: Todo[]) => Todo[]) {
	queryClient.setQueryData<Todo[]>(TODOS_KEY, (current) =>
		update(current ?? []),
	);
}

export function TodoApp() {
	const todos = useEngine("/todos");
	const [title, setTitle] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editTitle, setEditTitle] = useState("");

	const create = useEngineMutation("/todos/create", {
		onSuccess: (todo) => patchTodos((list) => [todo, ...list]),
		onSettled: () => todos.invalidate(),
	});

	const update = useEngineMutation("/todos/:id/update", {
		onMutate: async ({ body }) => {
			await queryClient.cancelQueries({ queryKey: TODOS_KEY });
			const previous = queryClient.getQueryData<Todo[]>(TODOS_KEY);
			patchTodos((list) =>
				list.map((todo) => (todo.id === body.id ? { ...todo, ...body } : todo)),
			);
			return { previous };
		},
		onError: (_error, _variables, context) => {
			if (context?.previous)
				queryClient.setQueryData(TODOS_KEY, context.previous);
		},
		onSettled: () => todos.invalidate(),
	});

	const remove = useEngineMutation("/todos/:id/delete", {
		onMutate: async ({ query }) => {
			await queryClient.cancelQueries({ queryKey: TODOS_KEY });
			const previous = queryClient.getQueryData<Todo[]>(TODOS_KEY);
			patchTodos((list) => list.filter((todo) => todo.id !== query.id));
			return { previous };
		},
		onError: (_error, _variables, context) => {
			if (context?.previous)
				queryClient.setQueryData(TODOS_KEY, context.previous);
		},
		onSettled: () => todos.invalidate(),
	});

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) return;
		create.mutate(
			{ body: { title: trimmed } },
			{ onSuccess: () => setTitle("") },
		);
	};

	const startEdit = (todo: Todo) => {
		setEditingId(todo.id);
		setEditTitle(todo.title);
	};

	const commitEdit = (todo: Todo) => {
		const trimmed = editTitle.trim();
		setEditingId(null);
		if (!trimmed || trimmed === todo.title) return;
		update.mutate({ body: { id: todo.id, title: trimmed } });
	};

	const all = todos.data ?? [];
	const openCount = all.filter((t) => !t.completed).length;
	const doneCount = all.length - openCount;
	const visible = all.filter((t) =>
		filter === "all" ? true : filter === "open" ? !t.completed : t.completed,
	);
	const progress =
		all.length === 0 ? 0 : Math.round((doneCount / all.length) * 100);
	const error = create.error ?? update.error ?? remove.error ?? todos.error;

	return (
		<Card className="overflow-hidden">
			<CardContent className="p-0">
				<form
					onSubmit={submit}
					className="flex gap-2 border-b border-line bg-surface-2/60 p-4"
				>
					<Input
						type="text"
						placeholder="What needs to be done?"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						maxLength={200}
						disabled={create.isPending}
						autoFocus
					/>
					<Button
						type="submit"
						variant="accent"
						disabled={!title.trim() || create.isPending}
						aria-label="Add task"
					>
						{create.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Plus className="size-4" />
						)}
						<span className="hidden sm:inline">Add</span>
					</Button>
				</form>

				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
					<div className="flex gap-1">
						{(
							[
								["all", "All", all.length],
								["open", "Open", openCount],
								["done", "Done", doneCount],
							] as const
						).map(([value, label, count]) => (
							<button
								key={value}
								type="button"
								onClick={() => setFilter(value)}
								className={cn(
									"inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
									filter === value
										? "bg-ink text-ink-fg dark:bg-ink-fg dark:text-ink"
										: "text-fg-muted hover:bg-surface-2 hover:text-fg",
								)}
							>
								{label}
								<span className="tabular font-mono opacity-70">{count}</span>
							</button>
						))}
					</div>
					<div className="flex items-center gap-3">
						<div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-3">
							<div
								className="h-full rounded-full bg-accent transition-all duration-500"
								style={{ width: `${progress}%` }}
							/>
						</div>
						<span className="tabular font-mono text-xs text-fg-subtle">
							{progress}%
						</span>
					</div>
				</div>

				{error && (
					<p className="border-b border-danger/20 bg-danger-soft px-4 py-2.5 text-sm text-danger">
						{error.message}
						{error.issues.length > 0 && ` (${error.issues.join("; ")})`}
					</p>
				)}

				{todos.isPending ? (
					<div className="flex justify-center py-14">
						<Loader2 className="size-6 animate-spin text-accent-strong dark:text-accent" />
					</div>
				) : visible.length === 0 ? (
					<EmptyState
						className="m-4"
						icon={<Inbox className="size-5" aria-hidden />}
						title={
							all.length === 0
								? "Nothing here yet"
								: "Nothing matches this filter"
						}
						description={
							all.length === 0
								? "Add a task above. It will be created through POST /api/v1/todos/create."
								: "Switch the filter to see the rest of your tasks."
						}
					/>
				) : (
					<ul className="divide-y divide-line">
						{visible.map((todo) => {
							const busy =
								(update.isPending && update.variables?.body.id === todo.id) ||
								(remove.isPending && remove.variables?.query.id === todo.id);
							const editing = editingId === todo.id;

							return (
								<li
									key={todo.id}
									className={cn(
										"group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60",
										todo.completed && "opacity-70",
									)}
								>
									<button
										type="button"
										onClick={() =>
											update.mutate({
												body: { id: todo.id, completed: !todo.completed },
											})
										}
										disabled={busy}
										aria-label={
											todo.completed ? "Mark as not done" : "Mark as done"
										}
										className={cn(
											"flex size-5 shrink-0 items-center justify-center rounded-md border transition-all",
											todo.completed
												? "border-accent bg-accent text-accent-fg"
												: "border-line-strong text-transparent hover:border-accent",
										)}
									>
										{busy ? (
											<Loader2 className="size-3 animate-spin text-accent-strong" />
										) : (
											<Check className="size-3" strokeWidth={3} />
										)}
									</button>

									{editing ? (
										<form
											className="flex flex-1 items-center gap-2"
											onSubmit={(event) => {
												event.preventDefault();
												commitEdit(todo);
											}}
										>
											<Input
												value={editTitle}
												onChange={(event) => setEditTitle(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === "Escape") setEditingId(null);
												}}
												className="h-8"
												maxLength={200}
												autoFocus
											/>
											<Button
												type="submit"
												size="icon-sm"
												variant="accent"
												aria-label="Save"
											>
												<Check className="size-3.5" />
											</Button>
											<Button
												type="button"
												size="icon-sm"
												variant="ghost"
												aria-label="Cancel"
												onClick={() => setEditingId(null)}
											>
												<X className="size-3.5" />
											</Button>
										</form>
									) : (
										<>
											<button
												type="button"
												onDoubleClick={() => startEdit(todo)}
												className={cn(
													"flex-1 truncate text-left text-sm transition-all",
													todo.completed
														? "text-fg-subtle line-through"
														: "text-fg",
												)}
												title="Double-click to edit"
											>
												{todo.title}
											</button>
											<span className="hidden font-mono text-[11px] text-fg-subtle sm:inline">
												#{todo.id}
											</span>
											<div className="flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
												<Button
													type="button"
													size="icon-sm"
													variant="ghost"
													aria-label="Edit task"
													onClick={() => startEdit(todo)}
												>
													<Pencil className="size-3.5" />
												</Button>
												<Button
													type="button"
													size="icon-sm"
													variant="ghost"
													aria-label="Delete task"
													disabled={busy}
													className="hover:bg-danger-soft hover:text-danger"
													onClick={() =>
														remove.mutate({ query: { id: todo.id } })
													}
												>
													<Trash2 className="size-3.5" />
												</Button>
											</div>
										</>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
