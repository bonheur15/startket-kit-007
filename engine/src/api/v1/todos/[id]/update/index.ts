import { and, eq } from "drizzle-orm";
import { errors } from "../../../../../core/api/error";
import { requireAuth } from "../../../../../core/auth/require-auth";
import { db } from "../../../../../db";
import { todos } from "../../../../../db/schema";
import type { TodoResponse } from "../../index";

/** Update the title and/or completion state of one of the signed-in user's todos. */
export async function updateTodo(input: {
	id: number;
	title?: string;
	completed?: boolean;
}): Promise<TodoResponse> {
	const user = await requireAuth();

	const patch: Partial<{ title: string; completed: boolean }> = {};
	if (input.title !== undefined) {
		const title = input.title.trim();
		if (title.length === 0 || title.length > 200) {
			throw errors.badRequest("Title must be between 1 and 200 characters");
		}
		patch.title = title;
	}
	if (input.completed !== undefined) patch.completed = input.completed;
	if (Object.keys(patch).length === 0) {
		throw errors.badRequest("Provide at least one field to update");
	}

	const [todo] = await db
		.update(todos)
		.set(patch)
		.where(and(eq(todos.id, input.id), eq(todos.userId, user.id)))
		.returning({
			id: todos.id,
			title: todos.title,
			completed: todos.completed,
			createdAt: todos.createdAt,
			updatedAt: todos.updatedAt,
		});
	if (!todo) throw errors.notFound("Todo not found");
	return todo;
}
