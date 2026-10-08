import { env, type LogLevel } from "../config/env";

type Fields = Record<string, unknown>;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
	silent: 100,
};

const LEVEL_COLOR: Record<LogLevel, string> = {
	debug: "\x1b[90m",
	info: "\x1b[36m",
	warn: "\x1b[33m",
	error: "\x1b[31m",
	silent: "",
};
const RESET = "\x1b[0m";

function serializeError(error: unknown): Fields {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			...("cause" in error && error.cause
				? { cause: String(error.cause) }
				: {}),
		};
	}
	return { message: String(error) };
}

function normalizeFields(fields: Fields | undefined): Fields | undefined {
	if (!fields) return undefined;
	const out: Fields = {};
	for (const [key, value] of Object.entries(fields)) {
		out[key] = value instanceof Error ? serializeError(value) : value;
	}
	return out;
}

function write(level: LogLevel, message: string, fields?: Fields) {
	if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[env.logLevel]) return;

	const normalized = normalizeFields(fields);
	const sink =
		level === "error"
			? console.error
			: level === "warn"
				? console.warn
				: console.log;

	if (env.logFormat === "json") {
		sink(
			JSON.stringify({
				level,
				time: new Date().toISOString(),
				service: env.appName,
				msg: message,
				...normalized,
			}),
		);
		return;
	}

	const time = new Date().toISOString().slice(11, 23);
	const prefix = `${LEVEL_COLOR[level]}${level.toUpperCase().padEnd(5)}${RESET} ${time}`;
	if (normalized && Object.keys(normalized).length > 0) {
		sink(`${prefix} ${message}`, normalized);
	} else {
		sink(`${prefix} ${message}`);
	}
}

export type Logger = {
	debug(message: string, fields?: Fields): void;
	info(message: string, fields?: Fields): void;
	warn(message: string, fields?: Fields): void;
	error(message: string, fields?: Fields): void;
	/** Create a logger that attaches `bound` fields to every entry. */
	child(bound: Fields): Logger;
};

function createLogger(bound: Fields = {}): Logger {
	const merge = (fields?: Fields) => (fields ? { ...bound, ...fields } : bound);
	return {
		debug: (message, fields) => write("debug", message, merge(fields)),
		info: (message, fields) => write("info", message, merge(fields)),
		warn: (message, fields) => write("warn", message, merge(fields)),
		error: (message, fields) => write("error", message, merge(fields)),
		child: (extra) => createLogger({ ...bound, ...extra }),
	};
}

export const logger: Logger = createLogger();
