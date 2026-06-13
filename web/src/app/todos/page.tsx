import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { TodoApp } from "../../components/TodoApp";

export default function TodosPage() {
	const { user, isLoading } = useAuth();

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[400px]">
				<Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
				<p className="text-sm text-slate-400 mt-2 font-medium">
					Resolving session...
				</p>
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/" replace />;
	}

	return (
		<div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 bg-gray-50/30 rounded-3xl">
			<div className="w-full max-w-4xl">
				<div className="text-center mb-10">
					<h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl mb-4">
						Manage your <span className="text-amber-600">Tasks</span>
					</h1>
					<p className="text-xl text-gray-500 max-w-2xl mx-auto">
						A beautiful, full-stack todo application powered by Drizzle ORM and
						PostgreSQL, isolated strictly for <b>{user.name}</b>.
					</p>
				</div>
				<TodoApp />
			</div>
		</div>
	);
}
