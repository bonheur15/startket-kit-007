import { and, eq } from "drizzle-orm";
import { ApiError } from "../../../../../core/api/error";
import { requireAuth } from "../../../../../core/auth/require-auth";
import { db } from "../../../../../db";
import { todos } from "../../../../../db/schema";

type TodoResponse = {
	id: number;
	title: string;
	completed: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export async function updateTodo(input: {
	id: string;
	completed?: boolean;
	title?: string;
}): Promise<TodoResponse> {
	const user = requireAuth();
	const id = parseInt(input.id, 10);
	if (Number.isNaN(id)) throw new Error("Invalid ID");

	const [todo] = await db
		.update(todos)
		.set({
			...(input.completed !== undefined ? { completed: input.completed } : {}),
			...(input.title !== undefined ? { title: input.title } : {}),
		})
		.where(and(eq(todos.id, id), eq(todos.userId, user.id)))
		.returning();

	if (!todo) {
		throw new ApiError(404, "NOT_FOUND", "Todo not found");
	}

	return todo as TodoResponse;
}
