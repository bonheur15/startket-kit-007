import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

if (typeof Bun !== "undefined") {
	const server = Bun.serve(app);
	console.log(
		`[${env.appName}] listening on http://${server.hostname}:${server.port}`,
	);
}

export default app;
