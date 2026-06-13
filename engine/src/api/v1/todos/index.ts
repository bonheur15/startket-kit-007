import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../../../core/auth/require-auth";
import { db } from "../../../db";
import { todos } from "../../../db/schema";

type TodoResponse = {
	id: number;
	title: string;
	completed: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export async function getTodos(): Promise<TodoResponse[]> {
	const user = requireAuth();
	const results = await db
		.select()
		.from(todos)
		.where(eq(todos.userId, user.id))
		.orderBy(desc(todos.createdAt));
	return results as TodoResponse[];
}
