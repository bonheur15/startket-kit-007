import { env } from "../../config/env";
import type { OpenApiSchema } from "../schema";
import type { EndpointModule } from "./types";

type Parameter = {
	in: "path" | "query";
	name: string;
	required: boolean;
	schema: OpenApiSchema;
};

type Operation = {
	operationId: string;
	summary: string;
	description?: string;
	tags: string[];
	deprecated?: boolean;
	security?: Array<Record<string, string[]>>;
	parameters?: Parameter[];
	requestBody?: {
		required: boolean;
		content: { "application/json": { schema: OpenApiSchema } };
	};
	responses: Record<string, unknown>;
};

const META_SCHEMA: OpenApiSchema = {
	type: "object",
	properties: {
		requestId: { type: "string" },
		timestamp: { type: "string" },
	},
	required: ["requestId", "timestamp"],
	additionalProperties: false,
};

const ERROR_ENVELOPE_SCHEMA: OpenApiSchema = {
	type: "object",
	properties: {
		ok: { const: false, type: "boolean" },
		error: {
			type: "object",
			properties: {
				code: { type: "string" },
				message: { type: "string" },
				details: { description: "Optional structured details" },
			},
			required: ["code", "message"],
		},
		meta: META_SCHEMA,
	},
	required: ["ok", "error", "meta"],
	additionalProperties: false,
};

function isObjectSchema(schema: OpenApiSchema): schema is OpenApiSchema & {
	type: "object";
	properties?: Record<string, OpenApiSchema>;
	required?: string[];
} {
	return "type" in schema && schema.type === "object";
}

function omitProperties(
	schema: OpenApiSchema,
	keys: readonly string[],
): OpenApiSchema {
	if (!isObjectSchema(schema) || !schema.properties) return schema;
	return {
		...schema,
		properties: Object.fromEntries(
			Object.entries(schema.properties).filter(([key]) => !keys.includes(key)),
		) as Record<string, OpenApiSchema>,
		required: (schema.required ?? []).filter((key) => !keys.includes(key)),
	};
}

function errorResponse(description: string) {
	return {
		description,
		content: {
			"application/json": {
				schema: { $ref: "#/components/schemas/ErrorEnvelope" },
			},
		},
	};
}

function defaultTags(path: string): string[] {
	const match = /^\/api\/v\d+\/([^/]+)/.exec(path);
	return match?.[1] ? [match[1]] : ["default"];
}

/** Convert the runtime path syntax (`/todos/:id`) to OpenAPI (`/todos/{id}`). */
function toOpenApiPath(path: string): string {
	return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

export function createOpenApiDocument(endpoints: readonly EndpointModule[]) {
	const paths: Record<string, Record<string, Operation>> = {};
	const tags = new Set<string>();

	for (const endpoint of endpoints) {
		const openApiPath = toOpenApiPath(endpoint.path);
		const pathEntry = paths[openApiPath] ?? {};
		paths[openApiPath] = pathEntry;

		const parameters: Parameter[] = [];
		const inputOpenApi = endpoint.inputSchema?.openapi;

		if (inputOpenApi && isObjectSchema(inputOpenApi)) {
			const requiredFields = new Set(inputOpenApi.required ?? []);
			for (const [name, schema] of Object.entries(
				inputOpenApi.properties ?? {},
			)) {
				if (endpoint.pathParamNames.includes(name)) {
					parameters.push({ in: "path", name, required: true, schema });
				} else if (endpoint.inputSource === "query") {
					parameters.push({
						in: "query",
						name,
						required: requiredFields.has(name),
						schema,
					});
				}
			}
		}

		const operationTags = [...(endpoint.tags ?? defaultTags(endpoint.path))];
		for (const tag of operationTags) tags.add(tag);

		const responses: Record<string, unknown> = {
			"200": {
				description: "Successful response",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								ok: { const: true, type: "boolean" },
								data: endpoint.responseSchema.openapi,
								meta: META_SCHEMA,
							},
							required: ["ok", "data", "meta"],
							additionalProperties: false,
						},
					},
				},
			},
			"500": errorResponse("Unexpected server error"),
		};
		if (endpoint.inputSchema)
			responses["400"] = errorResponse("Validation failed");
		if (endpoint.auth)
			responses["401"] = errorResponse("Authentication required");

		pathEntry[endpoint.method.toLowerCase()] = {
			operationId: endpoint.operationId,
			summary: endpoint.summary ?? endpoint.operationId,
			description: endpoint.description,
			tags: operationTags,
			deprecated: endpoint.deprecated || undefined,
			security: endpoint.auth ? [{ cookieAuth: [] }] : undefined,
			parameters: parameters.length > 0 ? parameters : undefined,
			requestBody:
				endpoint.inputSource === "body" && inputOpenApi
					? {
							required: !endpoint.inputOptional,
							content: {
								"application/json": {
									schema: omitProperties(inputOpenApi, endpoint.pathParamNames),
								},
							},
						}
					: undefined,
			responses,
		};
	}

	return {
		openapi: "3.1.0",
		info: {
			title: `${env.appName} API`,
			version: env.apiVersion,
			description:
				"Generated from the TypeScript signatures of the endpoint functions in engine/src/api.",
		},
		servers: [{ url: env.apiUrl }],
		tags: [...tags].sort().map((name) => ({ name })),
		paths,
		components: {
			securitySchemes: {
				cookieAuth: { type: "apiKey", in: "cookie", name: "session" },
			},
			schemas: {
				ErrorEnvelope: ERROR_ENVELOPE_SCHEMA,
			},
		},
	};
}
