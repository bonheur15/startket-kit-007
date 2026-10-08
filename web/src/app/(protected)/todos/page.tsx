import { TodoApp } from "@/components/todo-app";
import { useAuth } from "@/lib/auth";

export default function TodosPage() {
	const { user } = useAuth();

	return (
		<div className="flex flex-col items-center p-4">
			<div className="w-full max-w-4xl">
				<div className="mb-10 text-center">
					<h1 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
						Manage your <span className="text-amber-600">tasks</span>
					</h1>
					<p className="mx-auto max-w-2xl text-lg text-slate-500">
						Mutations with optimistic updates, scoped to{" "}
						<b>{user?.name ?? user?.email}</b>.
					</p>
				</div>
				<TodoApp />
			</div>
		</div>
	);
}
