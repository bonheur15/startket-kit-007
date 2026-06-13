import { requireAuth } from "../../../../core/auth/require-auth";
import { db } from "../../../../db";
import { todos } from "../../../../db/schema";

type TodoResponse = {
	id: number;
	title: string;
	completed: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export async function createTodo(input: {
	title: string;
}): Promise<TodoResponse> {
	const user = requireAuth();
	const [todo] = await db
		.insert(todos)
		.values({
			title: input.title,
			userId: user.id,
		})
		.returning();
	return todo as TodoResponse;
}
