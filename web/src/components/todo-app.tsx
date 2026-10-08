import { Check, LayoutList, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	type EngineResponse,
	engineQueryKey,
	queryClient,
	useEngine,
	useEngineMutation,
} from "@/lib/engine";

type Todo = EngineResponse<"/todos">[number];

const TODOS_KEY = engineQueryKey("/todos");

/** Patch the cached todo list without waiting for the server. */
function patchTodos(update: (todos: Todo[]) => Todo[]) {
	queryClient.setQueryData<Todo[]>(TODOS_KEY, (current) =>
		update(current ?? []),
	);
}

export function TodoApp() {
	const todos = useEngine("/todos");
	const [title, setTitle] = useState("");

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

	const list = todos.data ?? [];
	const error = create.error ?? update.error ?? remove.error ?? todos.error;

	return (
		<div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-xl sm:p-10">
			<div className="mb-8 flex items-center gap-3">
				<div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
					<LayoutList size={28} strokeWidth={2.5} aria-hidden />
				</div>
				<h2 className="text-3xl font-bold text-amber-800">Tasks</h2>
			</div>

			<form onSubmit={submit} className="relative mb-6">
				<input
					type="text"
					placeholder="What needs to be done?"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					maxLength={200}
					className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-4 pl-6 pr-16 text-slate-800 placeholder-slate-400 shadow-sm transition-all focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
					disabled={create.isPending}
				/>
				<button
					type="submit"
					disabled={!title.trim() || create.isPending}
					aria-label="Add task"
					className="absolute bottom-2 right-2 top-2 flex aspect-square items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
				>
					{create.isPending ? (
						<Loader2 size={20} className="animate-spin" />
					) : (
						<Plus size={24} />
					)}
				</button>
			</form>

			{error && (
				<p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
					{error.message}
					{error.issues.length > 0 && ` (${error.issues.join("; ")})`}
				</p>
			)}

			<div className="space-y-3">
				{todos.isPending ? (
					<div className="flex justify-center py-8">
						<Loader2 className="animate-spin text-amber-600" size={32} />
					</div>
				) : list.length === 0 ? (
					<div className="rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 px-4 py-12 text-center">
						<p className="font-medium text-slate-500">All caught up!</p>
						<p className="mt-1 text-sm text-slate-400">
							Add a task above to get started.
						</p>
					</div>
				) : (
					list.map((todo) => {
						const busy =
							(update.isPending && update.variables?.body.id === todo.id) ||
							(remove.isPending && remove.variables?.query.id === todo.id);
						return (
							<div
								key={todo.id}
								className={`group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:border-amber-200 hover:shadow-md ${todo.completed ? "opacity-75" : ""}`}
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
									className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${todo.completed ? "border-amber-600 bg-amber-600 text-white" : "border-slate-300 text-transparent hover:border-amber-500"}`}
								>
									{busy ? (
										<Loader2
											size={12}
											className="animate-spin text-amber-600"
										/>
									) : (
										<Check size={14} strokeWidth={3} />
									)}
								</button>

								<span
									className={`flex-grow font-medium transition-all ${todo.completed ? "text-slate-400 line-through" : "text-slate-700"}`}
								>
									{todo.title}
								</span>

								<button
									type="button"
									onClick={() => remove.mutate({ query: { id: todo.id } })}
									disabled={busy}
									aria-label="Delete task"
									className="flex-shrink-0 rounded-xl p-2 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100"
								>
									<Trash2 size={18} />
								</button>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
