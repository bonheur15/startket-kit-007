import { Check, LayoutList, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { callEngine, useEngine } from "../../.generated/engine";

export function TodoApp() {
	const { data, isLoading, invalidate } = useEngine("/api/v1/todos");
	const [newTaskTitle, setNewTaskTitle] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [processingId, setProcessingId] = useState<number | null>(null);

	const todos = data ?? [];

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newTaskTitle.trim()) return;

		setIsAdding(true);
		try {
			await callEngine("/api/v1/todos/create", {
				body: { title: newTaskTitle },
			});
			setNewTaskTitle("");
			invalidate();
		} catch (error) {
			console.error("Failed to add todo", error);
		} finally {
			setIsAdding(false);
		}
	};

	const handleToggle = async (id: number, currentStatus: boolean) => {
		setProcessingId(id);
		try {
			await callEngine("/api/v1/todos/:id/update", {
				body: { id: id.toString(), completed: !currentStatus },
			});
			invalidate();
		} catch (error) {
			console.error("Failed to update todo", error);
		} finally {
			setProcessingId(null);
		}
	};

	const handleDelete = async (id: number) => {
		setProcessingId(id);
		try {
			await callEngine("/api/v1/todos/:id/delete", {
				query: { id: id.toString() },
			});
			invalidate();
		} catch (error) {
			console.error("Failed to delete todo", error);
		} finally {
			setProcessingId(null);
		}
	};

	return (
		<div className="w-full max-w-2xl mx-auto p-6 bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-10">
			<div className="flex items-center gap-3 mb-8">
				<div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
					<LayoutList size={28} strokeWidth={2.5} />
				</div>
				<h2 className="text-3xl font-bold text-amber-800">Tasks</h2>
			</div>

			<form onSubmit={handleAdd} className="relative mb-10 group">
				<input
					type="text"
					placeholder="What needs to be done?"
					value={newTaskTitle}
					onChange={(e) => setNewTaskTitle(e.target.value)}
					className="w-full pl-6 pr-16 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all shadow-sm group-hover:shadow-md"
					disabled={isAdding}
				/>
				<button
					type="submit"
					disabled={!newTaskTitle.trim() || isAdding}
					className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:hover:bg-amber-600 transition-colors shadow-sm"
				>
					{isAdding ? (
						<Loader2 size={20} className="animate-spin" />
					) : (
						<Plus size={24} />
					)}
				</button>
			</form>

			<div className="space-y-3">
				{isLoading ? (
					<div className="flex justify-center py-8">
						<Loader2 className="animate-spin text-amber-600" size={32} />
					</div>
				) : todos.length === 0 ? (
					<div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/50">
						<p className="text-gray-500 font-medium">All caught up! 🎉</p>
						<p className="text-sm text-gray-400 mt-1">
							Add a task above to get started.
						</p>
					</div>
				) : (
					todos.map((todo) => (
						<div
							key={todo.id}
							className={`group flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl transition-all duration-200 hover:shadow-md hover:border-amber-200 ${todo.completed ? "opacity-75" : ""}`}
						>
							<button
								type="button"
								onClick={() => handleToggle(todo.id, todo.completed)}
								disabled={processingId === todo.id}
								className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all ${todo.completed ? "bg-amber-600 border-amber-600 text-white" : "border-gray-300 hover:border-amber-500 text-transparent"}`}
							>
								{processingId === todo.id ? (
									<Loader2 size={12} className="animate-spin text-amber-600" />
								) : (
									<Check
										size={14}
										strokeWidth={3}
										className={
											todo.completed
												? "opacity-100"
												: "opacity-0 group-hover:opacity-20"
										}
									/>
								)}
							</button>

							<span
								className={`flex-grow font-medium transition-all ${todo.completed ? "text-gray-400 line-through" : "text-gray-700"}`}
							>
								{todo.title}
							</span>

							<button
								type="button"
								onClick={() => handleDelete(todo.id)}
								disabled={processingId === todo.id}
								className="flex-shrink-0 p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
								aria-label="Delete todo"
							>
								<Trash2 size={18} />
							</button>
						</div>
					))
				)}
			</div>
		</div>
	);
}
