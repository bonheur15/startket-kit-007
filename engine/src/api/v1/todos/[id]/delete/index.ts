import { and, eq } from "drizzle-orm";
import { ApiError } from "../../../../../core/api/error";
import { requireAuth } from "../../../../../core/auth/require-auth";
import { db } from "../../../../../db";
import { todos } from "../../../../../db/schema";

export async function deleteTodo(input: {
	id: string;
}): Promise<{ success: boolean }> {
	const user = requireAuth();
	const id = parseInt(input.id, 10);
	if (Number.isNaN(id)) throw new Error("Invalid ID");

	const result = await db
		.delete(todos)
		.where(and(eq(todos.id, id), eq(todos.userId, user.id)))
		.returning();

	if (result.length === 0) {
		throw new ApiError(404, "NOT_FOUND", "Todo not found");
	}

	return { success: true };
}
