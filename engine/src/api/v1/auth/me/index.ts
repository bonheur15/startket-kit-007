import { requireAuth } from "../../../../core/auth/require-auth";

type MeResponse = {
	id: number;
	email: string;
	name: string | null;
	picture: string | null;
};

export async function getAuthMe(): Promise<MeResponse> {
	const user = requireAuth();
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		picture: user.picture,
	};
}
