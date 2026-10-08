import { errors } from "../../../../core/api/error";
import { requireAuth } from "../../../../core/auth/require-auth";
import { db } from "../../../../db";
import { todos } from "../../../../db/schema";
import type { TodoResponse } from "../index";

/** Create a todo for the signed-in user. */
export async function createTodo(input: {
	title: string;
}): Promise<TodoResponse> {
	const user = await requireAuth();
	const title = input.title.trim();
	if (title.length === 0 || title.length > 200) {
		throw errors.badRequest("Title must be between 1 and 200 characters");
	}

	const [todo] = await db
		.insert(todos)
		.values({ title, userId: user.id })
		.returning({
			id: todos.id,
			title: todos.title,
			completed: todos.completed,
			createdAt: todos.createdAt,
			updatedAt: todos.updatedAt,
		});
	if (!todo) throw errors.internal("Failed to create todo");
	return todo;
}
