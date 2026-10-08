import { and, eq } from "drizzle-orm";
import { errors } from "../../../../../core/api/error";
import { requireAuth } from "../../../../../core/auth/require-auth";
import { db } from "../../../../../db";
import { todos } from "../../../../../db/schema";

/** Delete one of the signed-in user's todos. */
export async function deleteTodo(input: {
	id: number;
}): Promise<{ success: boolean }> {
	const user = await requireAuth();
	const deleted = await db
		.delete(todos)
		.where(and(eq(todos.id, input.id), eq(todos.userId, user.id)))
		.returning({ id: todos.id });
	if (deleted.length === 0) throw errors.notFound("Todo not found");
	return { success: true };
}
