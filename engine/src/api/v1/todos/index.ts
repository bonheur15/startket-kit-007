import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../../../core/auth/require-auth";
import { db } from "../../../db";
import { todos } from "../../../db/schema";

export type TodoResponse = {
	id: number;
	title: string;
	completed: boolean;
	createdAt: Date;
	updatedAt: Date;
};

/** List the signed-in user's todos, newest first. */
export async function getTodos(): Promise<TodoResponse[]> {
	const user = await requireAuth();
	return db
		.select({
			id: todos.id,
			title: todos.title,
			completed: todos.completed,
			createdAt: todos.createdAt,
			updatedAt: todos.updatedAt,
		})
		.from(todos)
		.where(eq(todos.userId, user.id))
		.orderBy(desc(todos.createdAt));
}
