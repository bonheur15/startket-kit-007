import { requireAuth } from "../../../../core/auth/require-auth";

export type MeResponse = {
	id: number;
	email: string;
	name: string | null;
	picture: string | null;
	createdAt: Date;
};

/** Profile of the signed-in user. */
export async function getAuthMe(): Promise<MeResponse> {
	const user = await requireAuth();
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		picture: user.picture,
		createdAt: user.createdAt,
	};
}
