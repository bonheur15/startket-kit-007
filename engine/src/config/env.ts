const DEFAULT_PORT = 3000;
const DEFAULT_HOSTNAME = "0.0.0.0";

function parsePort(value: string | undefined): number {
	if (!value) {
		return DEFAULT_PORT;
	}

	const parsed = Number.parseInt(value, 10);

	if (!Number.isInteger(parsed) || parsed <= 0) {
		return DEFAULT_PORT;
	}

	return parsed;
}

export const env = {
	appName: (process.env.APP_NAME as string | undefined) ?? "starterkit-engine",
	appEnv: (process.env.NODE_ENV as string | undefined) ?? "development",
	apiVersion: "v1",
	hostname: (process.env.HOST as string | undefined) ?? DEFAULT_HOSTNAME,
	port: parsePort(process.env.PORT as string | undefined),
	corsOrigin: (process.env.CORS_ORIGIN as string | undefined) ?? "*",
	debugApi: process.env.DEBUG_API === "true",
} as const;
