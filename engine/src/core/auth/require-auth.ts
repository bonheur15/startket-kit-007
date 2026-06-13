import { ApiError } from "../api/error";
import { requestStorage } from "../api/runtime";

export function requireAuth() {
	const store = requestStorage.getStore();
	if (!store?.user) {
		throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
	}
	return store.user;
}
