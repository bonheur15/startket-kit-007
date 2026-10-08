/**
 * Function-first API generator.
 *
 * Scans `src/api/**\/index.ts`, infers each endpoint's method, path, input and
 * output types with the TypeScript compiler API, and writes:
 *
 *   engine/.generated/endpoints.ts         runtime manifest (schemas + handlers)
 *   engine/.generated/openapi-document.ts  OpenAPI 3.1 document
 *   web/.generated/api-client.ts           typed per-operation functions
 *   web/.generated/api-hooks.ts            typed per-operation React Query hooks
 *   web/.generated/engine.ts               path-based `useEngine` / `callEngine` / `useEngineMutation`
 *   openapi.json                           OpenAPI document (repo root)
 */
import path from "node:path";
import ts from "typescript";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Purpose = "input" | "response";

/** Intermediate representation of a type, shared by the schema and TS printers. */
type TypeNode =
	| { kind: "string" }
	| { kind: "number" }
	| { kind: "boolean" }
	| { kind: "date" }
	| { kind: "void" }
	| { kind: "literal"; value: string | number | boolean | null }
	| { kind: "enum"; values: string[] }
	| { kind: "array"; item: TypeNode }
	| { kind: "tuple"; items: TypeNode[] }
	| { kind: "optional"; inner: TypeNode }
	| { kind: "nullable"; inner: TypeNode }
	| { kind: "union"; members: TypeNode[] }
	| { kind: "record"; value: TypeNode }
	| {
			kind: "object";
			props: { name: string; optional: boolean; node: TypeNode }[];
	  };

type EndpointDescriptor = {
	functionName: string;
	file: string;
	importPath: string;
	routePath: string;
	routeAliases: string[];
	method: HttpMethod;
	input?: TypeNode;
	inputOptional: boolean;
	inputSource: "none" | "query" | "body";
	response: TypeNode;
	pathParamNames: string[];
	summary?: string;
	description?: string;
	tags: string[];
	auth: boolean;
	deprecated: boolean;
};

const projectRoot = new URL("../", import.meta.url);
const apiRoot = new URL("../src/api/", import.meta.url);
const engineGeneratedRoot = new URL("../.generated/", import.meta.url);
const webGeneratedRoot = new URL("../../web/.generated/", import.meta.url);
const repoRoot = new URL("../../", import.meta.url);

const METHOD_PREFIXES: Array<[HttpMethod, string[]]> = [
	["GET", ["get", "list", "find", "search", "fetch"]],
	["POST", ["create", "post", "add"]],
	["PUT", ["update", "put"]],
	["PATCH", ["patch", "edit"]],
	["DELETE", ["delete", "remove"]],
];

class GeneratorError extends Error {
	constructor(file: string, message: string) {
		super(
			`${toPosix(path.relative(Bun.fileURLToPath(repoRoot), file))}: ${message}`,
		);
		this.name = "GeneratorError";
	}
}

function toPosix(value: string): string {
	return value.replaceAll("\\", "/");
}

function getSourceFiles(rootDir: string): string[] {
	return ts.sys
		.readDirectory(rootDir, [".ts"], undefined, ["**/index.ts"])
		.sort();
}

function detectMethod(functionName: string, file: string): HttpMethod {
	const lower = functionName.toLowerCase();
	for (const [method, prefixes] of METHOD_PREFIXES) {
		if (prefixes.some((prefix) => lower.startsWith(prefix))) return method;
	}
	const all = METHOD_PREFIXES.flatMap(([, prefixes]) => prefixes).join(", ");
	throw new GeneratorError(
		file,
		`Cannot infer HTTP method from "${functionName}". Function names must start with one of: ${all}.`,
	);
}

function getRouteInfo(relativeFile: string) {
	const withoutIndex = toPosix(relativeFile).replace(/\/index\.ts$/, "");
	const pathParamNames: string[] = [];
	const routePath = `/api/${withoutIndex
		.split("/")
		.map((segment) => {
			if (segment.startsWith("[") && segment.endsWith("]")) {
				const name = segment.slice(1, -1);
				pathParamNames.push(name);
				return `:${name}`;
			}
			return segment;
		})
		.join("/")}`;
	return { routePath, pathParamNames };
}

// ---------------------------------------------------------------------------
// Type → IR
// ---------------------------------------------------------------------------

type ConvertContext = {
	checker: ts.TypeChecker;
	purpose: Purpose;
	file: string;
	stack: ts.Type[];
};

function isUndefined(type: ts.Type) {
	return (type.flags & ts.TypeFlags.Undefined) !== 0;
}
function isNull(type: ts.Type) {
	return (type.flags & ts.TypeFlags.Null) !== 0;
}

function unionOf(types: ts.Type[], checker: ts.TypeChecker): ts.Type {
	const first = types[0];
	if (types.length === 1 && first) return first;
	return checker.getUnionType(types, ts.UnionReduction.None);
}

function toNode(type: ts.Type, ctx: ConvertContext): TypeNode {
	const { checker, purpose, file } = ctx;

	if (ctx.stack.includes(type)) {
		throw new GeneratorError(
			file,
			`Recursive type "${checker.typeToString(type)}" is not supported in ${purpose} types.`,
		);
	}
	if (ctx.stack.length > 32) {
		throw new GeneratorError(file, `Type nesting too deep in ${purpose} type.`);
	}

	const flags = type.flags;

	if (flags & ts.TypeFlags.Any) {
		throw new GeneratorError(
			file,
			`"any" is not allowed in ${purpose} types. Use a concrete type.`,
		);
	}
	if (flags & ts.TypeFlags.Unknown) {
		throw new GeneratorError(
			file,
			`"unknown" is not allowed in ${purpose} types. Use a concrete type.`,
		);
	}
	if (flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined))
		return { kind: "void" };
	if (flags & ts.TypeFlags.Null) return { kind: "literal", value: null };

	if (
		type.getSymbol()?.getName() === "Date" ||
		checker.typeToString(type) === "Date"
	) {
		return { kind: "date" };
	}

	if (checker.isTupleType(type)) {
		const items = ((type as ts.TypeReference).typeArguments ?? []).map((item) =>
			toNode(item, { ...ctx, stack: [...ctx.stack, type] }),
		);
		return { kind: "tuple", items };
	}

	if (type.isUnion()) {
		const members = type.types;
		const hasUndefined = members.some(isUndefined);
		const hasNull = members.some(isNull);

		if (hasUndefined) {
			const rest = members.filter((m) => !isUndefined(m));
			return { kind: "optional", inner: toNode(unionOf(rest, checker), ctx) };
		}
		if (hasNull) {
			const rest = members.filter((m) => !isNull(m));
			return { kind: "nullable", inner: toNode(unionOf(rest, checker), ctx) };
		}
		if (
			members.every((m) => m.flags & ts.TypeFlags.BooleanLiteral) &&
			members.length === 2
		) {
			return { kind: "boolean" };
		}
		if (members.every((m) => m.flags & ts.TypeFlags.StringLiteral)) {
			return {
				kind: "enum",
				values: members.map((m) => (m as ts.StringLiteralType).value),
			};
		}
		return { kind: "union", members: members.map((m) => toNode(m, ctx)) };
	}

	if (flags & ts.TypeFlags.StringLiteral) {
		return { kind: "literal", value: (type as ts.StringLiteralType).value };
	}
	if (flags & ts.TypeFlags.NumberLiteral) {
		return { kind: "literal", value: (type as ts.NumberLiteralType).value };
	}
	if (flags & ts.TypeFlags.BooleanLiteral) {
		return { kind: "literal", value: checker.typeToString(type) === "true" };
	}
	if (flags & ts.TypeFlags.String) return { kind: "string" };
	if (flags & ts.TypeFlags.Number) return { kind: "number" };
	if (flags & ts.TypeFlags.Boolean) return { kind: "boolean" };

	if (checker.isArrayType(type)) {
		const item = (type as ts.TypeReference).typeArguments?.[0];
		if (!item) {
			throw new GeneratorError(
				file,
				`Cannot resolve array item type for ${checker.typeToString(type)}.`,
			);
		}
		return {
			kind: "array",
			item: toNode(item, { ...ctx, stack: [...ctx.stack, type] }),
		};
	}

	const stringIndex = checker.getIndexTypeOfType(type, ts.IndexKind.String);
	if (stringIndex && type.getProperties().length === 0) {
		return {
			kind: "record",
			value: toNode(stringIndex, { ...ctx, stack: [...ctx.stack, type] }),
		};
	}

	if (type.isIntersection() || flags & ts.TypeFlags.Object) {
		const nested = { ...ctx, stack: [...ctx.stack, type] };
		const props = type.getProperties().map((property) => {
			const declaration =
				property.valueDeclaration ?? property.declarations?.[0];
			if (!declaration) {
				throw new GeneratorError(
					file,
					`Cannot resolve declaration of property "${property.name}".`,
				);
			}
			const propertyType = checker.getTypeOfSymbolAtLocation(
				property,
				declaration,
			);
			const declaredOptional =
				(property.getFlags() & ts.SymbolFlags.Optional) !== 0;
			const unionHasUndefined =
				propertyType.isUnion() && propertyType.types.some(isUndefined);
			const base =
				propertyType.isUnion() && unionHasUndefined
					? unionOf(
							propertyType.types.filter((m) => !isUndefined(m)),
							checker,
						)
					: propertyType;
			const node = toNode(base, nested);
			return {
				name: property.name,
				optional: declaredOptional || unionHasUndefined,
				node,
			};
		});
		if (props.length === 0 && type.getCallSignatures().length > 0) {
			throw new GeneratorError(
				file,
				`Functions are not serialisable (${purpose} type).`,
			);
		}
		return { kind: "object", props };
	}

	throw new GeneratorError(
		file,
		`Unsupported ${purpose} type: ${checker.typeToString(type)}.`,
	);
}

// ---------------------------------------------------------------------------
// IR → runtime schema expression / TS type text
// ---------------------------------------------------------------------------

function toSchemaExpr(node: TypeNode, purpose: Purpose): string {
	const coerce = purpose === "input";
	switch (node.kind) {
		case "string":
			return "s.string()";
		case "number":
			return coerce ? "s.number({ coerce: true })" : "s.number()";
		case "boolean":
			return coerce ? "s.boolean({ coerce: true })" : "s.boolean()";
		case "date":
			return "s.date()";
		case "void":
			return "s.void()";
		case "literal":
			return `s.literal(${JSON.stringify(node.value)})`;
		case "enum":
			return `s.enum([${node.values.map((v) => JSON.stringify(v)).join(", ")}] as const)`;
		case "array":
			return `s.array(${toSchemaExpr(node.item, purpose)})`;
		case "tuple":
			return `s.tuple([${node.items.map((i) => toSchemaExpr(i, purpose)).join(", ")}] as const)`;
		case "optional":
			return `s.optional(${toSchemaExpr(node.inner, purpose)})`;
		case "nullable":
			return `s.nullable(${toSchemaExpr(node.inner, purpose)})`;
		case "union":
			return `s.union([${node.members.map((m) => toSchemaExpr(m, purpose)).join(", ")}])`;
		case "record":
			return `s.record(${toSchemaExpr(node.value, purpose)})`;
		case "object":
			return `s.object({ ${node.props
				.map((p) => {
					const inner = toSchemaExpr(p.node, purpose);
					return `${JSON.stringify(p.name)}: ${p.optional ? `s.optional(${inner})` : inner}`;
				})
				.join(", ")} })`;
	}
}

/** Print the wire-level TypeScript type: `Date` becomes `string` on the way out. */
function toTsType(node: TypeNode, purpose: Purpose): string {
	switch (node.kind) {
		case "string":
			return "string";
		case "number":
			return "number";
		case "boolean":
			return "boolean";
		case "date":
			return purpose === "input" ? "string | Date" : "string";
		case "void":
			return "void";
		case "literal":
			return JSON.stringify(node.value);
		case "enum":
			return node.values.map((v) => JSON.stringify(v)).join(" | ");
		case "array":
			return `Array<${toTsType(node.item, purpose)}>`;
		case "tuple":
			return `[${node.items.map((i) => toTsType(i, purpose)).join(", ")}]`;
		case "optional":
			return `${toTsType(node.inner, purpose)} | undefined`;
		case "nullable":
			return `${toTsType(node.inner, purpose)} | null`;
		case "union":
			return node.members.map((m) => toTsType(m, purpose)).join(" | ");
		case "record":
			return `Record<string, ${toTsType(node.value, purpose)}>`;
		case "object":
			if (node.props.length === 0) return "Record<string, never>";
			return `{ ${node.props
				.map(
					(p) =>
						`${JSON.stringify(p.name)}${p.optional ? "?" : ""}: ${toTsType(p.node, purpose)}`,
				)
				.join("; ")} }`;
	}
}

// ---------------------------------------------------------------------------
// Endpoint discovery
// ---------------------------------------------------------------------------

function getEndpointFunction(
	sourceFile: ts.SourceFile,
	checker: ts.TypeChecker,
): { declaration: ts.FunctionDeclaration; symbol: ts.Symbol } {
	const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
	if (!moduleSymbol) {
		throw new GeneratorError(sourceFile.fileName, "File has no exports.");
	}

	const functions: {
		declaration: ts.FunctionDeclaration;
		symbol: ts.Symbol;
	}[] = [];
	const offenders: string[] = [];

	for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
		const declaration = symbol.getDeclarations()?.[0];
		if (!declaration) continue;
		if (ts.isFunctionDeclaration(declaration) && declaration.name) {
			functions.push({ declaration, symbol });
		} else if (
			ts.isTypeAliasDeclaration(declaration) ||
			ts.isInterfaceDeclaration(declaration) ||
			ts.isEnumDeclaration(declaration)
		) {
			// Type-only exports are fine.
		} else {
			offenders.push(symbol.getName());
		}
	}

	if (offenders.length > 0) {
		throw new GeneratorError(
			sourceFile.fileName,
			`Only one \`export function\` plus type exports are allowed. Unexpected exports: ${offenders.join(", ")}.`,
		);
	}
	if (functions.length === 0) {
		throw new GeneratorError(
			sourceFile.fileName,
			"Expected exactly one exported function, found none.",
		);
	}
	if (functions.length > 1) {
		throw new GeneratorError(
			sourceFile.fileName,
			`Expected exactly one exported function, found ${functions.length} (${functions
				.map((f) => f.symbol.getName())
				.join(", ")}). Move each endpoint into its own folder.`,
		);
	}

	return functions[0] as {
		declaration: ts.FunctionDeclaration;
		symbol: ts.Symbol;
	};
}

function readJsDoc(declaration: ts.FunctionDeclaration) {
	let summary: string | undefined;
	let description: string | undefined;
	const tags: string[] = [];
	let deprecated = false;

	for (const doc of ts.getJSDocCommentsAndTags(declaration)) {
		if (ts.isJSDoc(doc)) {
			const text = ts.getTextOfJSDocComment(doc.comment)?.trim();
			if (text) {
				const [first, ...rest] = text.split(/\r?\n/);
				summary ??= first?.trim();
				const body = rest.join("\n").trim();
				if (body) description = body;
			}
		}
	}

	for (const tag of ts.getJSDocTags(declaration)) {
		const name = tag.tagName.text;
		const text = ts.getTextOfJSDocComment(tag.comment)?.trim();
		if (name === "tag" && text)
			tags.push(...text.split(/[,\s]+/).filter(Boolean));
		if (name === "summary" && text) summary = text;
		if (name === "deprecated") deprecated = true;
	}

	return { summary, description, tags, deprecated };
}

function unwrapPromise(type: ts.Type): ts.Type {
	const reference = type as ts.TypeReference;
	if (
		type.getSymbol()?.getName() === "Promise" &&
		reference.typeArguments?.[0]
	) {
		return reference.typeArguments[0];
	}
	return type;
}

function getRouteAliases(routePath: string): string[] {
	const aliases = new Set<string>([routePath]);
	const withoutApi = routePath.startsWith("/api/")
		? routePath.slice(4)
		: routePath;
	aliases.add(withoutApi);
	const versioned = /^\/v\d+\/(.+)$/.exec(withoutApi);
	if (versioned?.[1]) {
		aliases.add(`/${versioned[1]}`);
		const system = /^system\/(.+)$/.exec(versioned[1]);
		if (system?.[1]) aliases.add(`/${system[1]}`);
	}
	return [...aliases];
}

function parseEndpoints(
	program: ts.Program,
	rootDir: string,
	files: string[],
): EndpointDescriptor[] {
	const checker = program.getTypeChecker();
	const endpoints: EndpointDescriptor[] = [];
	const seenRoutes = new Map<string, string>();

	for (const fileName of files) {
		const sourceFile = program.getSourceFile(fileName);
		if (!sourceFile)
			throw new GeneratorError(fileName, "Unable to load source file.");

		const { declaration, symbol } = getEndpointFunction(sourceFile, checker);
		const functionName = declaration.name?.text;
		if (!functionName)
			throw new GeneratorError(fileName, "Endpoint function must be named.");

		const signature = checker
			.getTypeOfSymbolAtLocation(symbol, declaration)
			.getCallSignatures()[0];
		if (!signature)
			throw new GeneratorError(
				fileName,
				`Unable to resolve signature of ${functionName}.`,
			);

		if (declaration.parameters.length > 1) {
			throw new GeneratorError(
				fileName,
				`${functionName} takes ${declaration.parameters.length} parameters; endpoints accept at most one input object.`,
			);
		}

		const parameterSymbol = signature.getParameters()[0];
		const parameterDeclaration = declaration.parameters[0];
		const rawInputType =
			parameterSymbol && parameterDeclaration
				? checker.getTypeOfSymbolAtLocation(
						parameterSymbol,
						parameterDeclaration,
					)
				: undefined;

		const inputOptional =
			rawInputType === undefined ||
			parameterDeclaration?.questionToken !== undefined ||
			(rawInputType.isUnion() && rawInputType.types.some(isUndefined));

		let input: TypeNode | undefined;
		if (rawInputType) {
			const base =
				rawInputType.isUnion() && rawInputType.types.some(isUndefined)
					? unionOf(
							rawInputType.types.filter((m) => !isUndefined(m)),
							checker,
						)
					: rawInputType;
			input = toNode(base, {
				checker,
				purpose: "input",
				file: fileName,
				stack: [],
			});
			if (input.kind !== "object") {
				throw new GeneratorError(
					fileName,
					`${functionName}: the input parameter must be an object type (got ${toTsType(input, "input")}).`,
				);
			}
		}

		const responseType = unwrapPromise(
			checker.getReturnTypeOfSignature(signature),
		);
		const response = toNode(responseType, {
			checker,
			purpose: "response",
			file: fileName,
			stack: [],
		});

		const relativeFile = toPosix(path.relative(rootDir, fileName));
		const { routePath, pathParamNames } = getRouteInfo(relativeFile);
		const method = detectMethod(functionName, fileName);

		for (const param of pathParamNames) {
			if (!input?.props.some((p) => p.name === param)) {
				throw new GeneratorError(
					fileName,
					`${functionName}: path parameter "${param}" must be declared in the input type.`,
				);
			}
		}

		const routeKey = `${method} ${routePath}`;
		const previous = seenRoutes.get(routeKey);
		if (previous) {
			throw new GeneratorError(
				fileName,
				`Route ${routeKey} is already defined by ${previous}.`,
			);
		}
		seenRoutes.set(routeKey, functionName);

		const doc = readJsDoc(declaration);

		endpoints.push({
			functionName,
			file: fileName,
			importPath: `../src/api/${relativeFile.replace(/\/index\.ts$/, "")}`,
			routePath,
			routeAliases: getRouteAliases(routePath),
			method,
			input,
			inputOptional,
			inputSource: input
				? method === "GET" || method === "DELETE"
					? "query"
					: "body"
				: "none",
			response,
			pathParamNames,
			summary: doc.summary,
			description: doc.description,
			tags: doc.tags,
			auth: declaration.body?.getText().includes("requireAuth(") ?? false,
			deprecated: doc.deprecated,
		});
	}

	const names = new Map<string, string>();
	for (const endpoint of endpoints) {
		const previous = names.get(endpoint.functionName);
		if (previous) {
			throw new GeneratorError(
				endpoint.file,
				`Function name "${endpoint.functionName}" is already used by ${previous}. Endpoint names must be unique.`,
			);
		}
		names.set(endpoint.functionName, endpoint.file);
	}

	return endpoints;
}

// ---------------------------------------------------------------------------
// Emitters
// ---------------------------------------------------------------------------

const HEADER =
	"/* This file is generated by engine/scripts/generate.ts. Do not edit. */";

function pascalCase(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildManifestFile(endpoints: EndpointDescriptor[]): string {
	const imports = endpoints
		.map(
			(e, i) =>
				`import { ${e.functionName} as handler${i + 1} } from "${e.importPath}";`,
		)
		.join("\n");

	const entries = endpoints
		.map(
			(e, i) => `	{
		operationId: ${JSON.stringify(e.functionName)},
		method: ${JSON.stringify(e.method)},
		path: ${JSON.stringify(e.routePath)},
		inputSource: ${JSON.stringify(e.inputSource)},
		inputOptional: ${JSON.stringify(e.inputOptional)},
		pathParamNames: ${JSON.stringify(e.pathParamNames)},
		inputSchema: ${e.input ? (e.inputOptional ? `s.optional(${toSchemaExpr(e.input, "input")})` : toSchemaExpr(e.input, "input")) : "undefined"},
		responseSchema: ${toSchemaExpr(e.response, "response")},
		summary: ${JSON.stringify(e.summary)},
		description: ${JSON.stringify(e.description)},
		tags: ${e.tags.length > 0 ? JSON.stringify(e.tags) : "undefined"},
		auth: ${e.auth},
		deprecated: ${e.deprecated},
		handler: handler${i + 1},
	},`,
		)
		.join("\n");

	return `${HEADER}
import type { EndpointModule } from "../src/core/api/types";
import { s } from "../src/core/schema";
${imports}

export const endpoints: readonly EndpointModule[] = [
${entries}
];
`;
}

function inputTypeText(e: EndpointDescriptor): string {
	if (!e.input) return "undefined";
	const text = toTsType(e.input, "input");
	return e.inputOptional ? `${text} | undefined` : text;
}

function buildWebClientFile(endpoints: EndpointDescriptor[]): string {
	const blocks = endpoints.map((e) => {
		const name = pascalCase(e.functionName);
		const hasInput = e.inputSource !== "none";
		const inputParam = hasInput
			? `input${e.inputOptional ? "?" : ""}: ${name}Input, `
			: "";
		const wrapped = hasInput
			? e.inputSource === "body"
				? "{ body: input }"
				: "{ query: input }"
			: "undefined";
		const doc = e.summary
			? `/** ${e.summary}${e.deprecated ? " @deprecated" : ""} */\n`
			: "";

		return `export type ${name}Input = ${inputTypeText(e)};
export type ${name}Response = ${toTsType(e.response, "response")};

export const ${name}Meta = {
	operationId: ${JSON.stringify(e.functionName)},
	method: ${JSON.stringify(e.method)},
	path: ${JSON.stringify(e.routePath)},
	inputSource: ${JSON.stringify(e.inputSource)},
	auth: ${e.auth},
} as const;

${doc}export function ${e.functionName}(${inputParam}options?: RequestOptions): Promise<${name}Response> {
	return apiRequest<${name}Response>(${name}Meta, ${wrapped}, options);
}`;
	});

	return `${HEADER}
import { apiRequest, type RequestOptions } from "../src/lib/api/client";

${blocks.join("\n\n")}
`;
}

function buildWebHooksFile(endpoints: EndpointDescriptor[]): string {
	const imports = endpoints
		.map((e) => {
			const name = pascalCase(e.functionName);
			const inputImport =
				e.inputSource === "none" ? "" : `\n	type ${name}Input,`;
			return `	${name}Meta,${inputImport}\n	type ${name}Response,`;
		})
		.join("\n");

	const hooks = endpoints.map((e) => {
		const name = pascalCase(e.functionName);
		const hasInput = e.inputSource !== "none";
		const wrapped = hasInput
			? e.inputSource === "body"
				? "{ body: input }"
				: "{ query: input }"
			: "undefined";

		if (e.method === "GET") {
			const inputParam = hasInput
				? `input${e.inputOptional ? "?" : ""}: ${name}Input, `
				: "";
			return `export function use${name}Query(${inputParam}options?: ApiQueryOptions<${name}Response>) {
	return useApiQuery<${name}Response>(${name}Meta, ${wrapped}, options);
}`;
		}

		const variables = hasInput ? `${name}Input` : "void";
		const mapper = hasInput
			? `(input: ${name}Input) => (${wrapped})`
			: "() => undefined";
		return `export function use${name}Mutation<TContext = unknown>(
	options?: ApiMutationOptions<${name}Response, ${variables}, TContext>,
) {
	return useApiMutation<${name}Response, ${variables}, TContext>(${name}Meta, ${mapper}, options);
}`;
	});

	return `${HEADER}
import {
	type ApiMutationOptions,
	type ApiQueryOptions,
	useApiMutation,
	useApiQuery,
} from "../src/lib/api/hooks";
import {
${imports}
} from "./api-client";

${hooks.join("\n\n")}
`;
}

function buildWebEngineFile(endpoints: EndpointDescriptor[]): string {
	const imports = endpoints
		.map((e) => {
			const name = pascalCase(e.functionName);
			const inputImport =
				e.inputSource === "none" ? "" : `\n	type ${name}Input,`;
			return `	${name}Meta,${inputImport}\n	type ${name}Response,`;
		})
		.join("\n");

	const registry = endpoints
		.flatMap((e) =>
			e.routeAliases.map(
				(alias) =>
					`	${JSON.stringify(alias)}: ${pascalCase(e.functionName)}Meta,`,
			),
		)
		.join("\n");

	const typeMap = endpoints
		.flatMap((e) => {
			const name = pascalCase(e.functionName);
			let inputType = "undefined";
			if (e.inputSource === "body") {
				inputType = e.inputOptional
					? `{ body?: ${name}Input; query?: never } | undefined`
					: `{ body: ${name}Input; query?: never }`;
			} else if (e.inputSource === "query") {
				inputType = e.inputOptional
					? `{ query?: ${name}Input; body?: never } | undefined`
					: `{ query: ${name}Input; body?: never }`;
			}
			return e.routeAliases.map(
				(alias) => `	${JSON.stringify(alias)}: {
		method: ${JSON.stringify(e.method)};
		input: ${inputType};
		response: ${name}Response;
	};`,
			);
		})
		.join("\n");

	return `${HEADER}
import { apiRequest, type RequestOptions } from "../src/lib/api/client";
import {
	type ApiMutationOptions,
	type ApiQueryOptions,
	apiQueryKey,
	invalidateApi,
	prefetchApi,
	useApiMutation,
	useApiQuery,
} from "../src/lib/api/hooks";
import {
${imports}
} from "./api-client";

/** Every alias of every endpoint, mapped to its metadata. */
export const engineRoutes = {
${registry}
} as const;

type EngineTypeMap = {
${typeMap}
};

export type EnginePath = keyof EngineTypeMap;
export type EngineMethod<TPath extends EnginePath> = EngineTypeMap[TPath]["method"];
export type EngineInput<TPath extends EnginePath> = EngineTypeMap[TPath]["input"];
export type EngineResponse<TPath extends EnginePath> = EngineTypeMap[TPath]["response"];

/** Paths that are read with \`useEngine\` (GET). */
export type EngineQueryPath = {
	[P in EnginePath]: EngineMethod<P> extends "GET" ? P : never;
}[EnginePath];

/** Paths that are written with \`useEngineMutation\` (POST/PUT/PATCH/DELETE). */
export type EngineMutationPath = Exclude<EnginePath, EngineQueryPath>;

type InputArgs<TPath extends EnginePath, TOptions> = undefined extends EngineInput<TPath>
	? [input?: EngineInput<TPath>, options?: TOptions]
	: [input: EngineInput<TPath>, options?: TOptions];

type MutationVariables<TPath extends EnginePath> = undefined extends EngineInput<TPath>
	? EngineInput<TPath> | void
	: EngineInput<TPath>;

/** Call any endpoint imperatively. */
export function callEngine<TPath extends EnginePath>(
	path: TPath,
	...args: InputArgs<TPath, RequestOptions>
): Promise<EngineResponse<TPath>> {
	const [input, options] = args;
	return apiRequest<EngineResponse<TPath>>(engineRoutes[path], input, options);
}

/** Read data with React Query. Only GET endpoints are allowed here. */
export function useEngine<TPath extends EngineQueryPath>(
	path: TPath,
	...args: InputArgs<TPath, ApiQueryOptions<EngineResponse<TPath>>>
) {
	const [input, options] = args;
	return useApiQuery<EngineResponse<TPath>>(engineRoutes[path], input, options);
}

/** Write data with React Query. Only non-GET endpoints are allowed here. */
export function useEngineMutation<TPath extends EngineMutationPath, TContext = unknown>(
	path: TPath,
	options?: ApiMutationOptions<EngineResponse<TPath>, MutationVariables<TPath>, TContext>,
) {
	return useApiMutation<EngineResponse<TPath>, MutationVariables<TPath>, TContext>(
		engineRoutes[path],
		(variables) => variables ?? undefined,
		options,
	);
}

/** Query key for a path + input, for manual cache access. */
export function engineQueryKey<TPath extends EnginePath>(path: TPath, input?: EngineInput<TPath>) {
	return apiQueryKey(engineRoutes[path], input);
}

/** Invalidate every cached query for a path (all inputs) and refetch active ones. */
export function invalidateEngine(path: EnginePath): Promise<void> {
	return invalidateApi(engineRoutes[path]);
}

/** Warm the cache before navigation. */
export function prefetchEngine<TPath extends EngineQueryPath>(
	path: TPath,
	...args: InputArgs<TPath, ApiQueryOptions<EngineResponse<TPath>>>
): Promise<void> {
	const [input, options] = args;
	return prefetchApi<EngineResponse<TPath>>(engineRoutes[path], input, options);
}
`;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function writeIfChanged(url: URL, content: string): Promise<boolean> {
	const file = Bun.file(url);
	if ((await file.exists()) && (await file.text()) === content) return false;
	await Bun.write(url, content);
	return true;
}

async function generateAll(
	program: ts.Program,
	rootDir: string,
	files: string[],
) {
	const endpoints = parseEndpoints(program, rootDir, files);

	await writeIfChanged(
		new URL("endpoints.ts", engineGeneratedRoot),
		buildManifestFile(endpoints),
	);

	// Build the OpenAPI document from the freshly written manifest so it uses
	// the exact runtime schemas.
	const { createOpenApiDocument } = await import("../src/core/api/openapi.ts");
	const manifest = (await import(
		new URL(`endpoints.ts?ts=${Date.now()}`, engineGeneratedRoot).href
	)) as { endpoints: Parameters<typeof createOpenApiDocument>[0] };
	const openapi = createOpenApiDocument(manifest.endpoints);

	await writeIfChanged(
		new URL("openapi-document.ts", engineGeneratedRoot),
		`${HEADER}\nexport const openapiDocument = ${JSON.stringify(openapi, null, "\t")} as const;\n`,
	);
	await writeIfChanged(
		new URL("api-client.ts", webGeneratedRoot),
		buildWebClientFile(endpoints),
	);
	await writeIfChanged(
		new URL("api-hooks.ts", webGeneratedRoot),
		buildWebHooksFile(endpoints),
	);
	await writeIfChanged(
		new URL("engine.ts", webGeneratedRoot),
		buildWebEngineFile(endpoints),
	);
	await writeIfChanged(
		new URL("openapi.json", repoRoot),
		`${JSON.stringify(openapi, null, "\t")}\n`,
	);

	const summary = endpoints
		.map(
			(e) =>
				`  ${e.method.padEnd(6)} ${e.routePath}${e.auth ? "  (auth)" : ""}`,
		)
		.join("\n");
	console.log(`Generated ${endpoints.length} endpoints:\n${summary}`);
}

function createProgram(files: string[]): ts.Program {
	const configPath = ts.findConfigFile(
		Bun.fileURLToPath(projectRoot),
		ts.sys.fileExists,
		"tsconfig.json",
	);
	if (!configPath) throw new Error("engine/tsconfig.json not found");
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	const parsed = ts.parseJsonConfigFileContent(
		config.config,
		ts.sys,
		path.dirname(configPath),
	);
	return ts.createProgram(files, { ...parsed.options, noEmit: true });
}

async function main() {
	const isWatch = process.argv.includes("--watch");
	const rootDir = Bun.fileURLToPath(apiRoot);

	if (!isWatch) {
		const files = getSourceFiles(rootDir);
		await generateAll(createProgram(files), rootDir, files);
		return;
	}

	const configPath = ts.findConfigFile(
		Bun.fileURLToPath(projectRoot),
		ts.sys.fileExists,
		"tsconfig.json",
	);
	if (!configPath) throw new Error("engine/tsconfig.json not found");

	const host = ts.createWatchCompilerHost(
		configPath,
		{ noEmit: true },
		ts.sys,
		ts.createSemanticDiagnosticsBuilderProgram,
		() => {},
		() => {},
	);

	const original = host.afterProgramCreate;
	host.afterProgramCreate = (builder) => {
		const files = getSourceFiles(rootDir);
		generateAll(builder.getProgram(), rootDir, files).catch(
			(error: unknown) => {
				console.error(error instanceof Error ? `✖ ${error.message}` : error);
			},
		);
		original?.(builder);
	};

	console.log("Generator watching src/api ...");
	ts.createWatchProgram(host);
}

try {
	await main();
} catch (error) {
	console.error(error instanceof Error ? `✖ ${error.message}` : error);
	process.exit(1);
}
