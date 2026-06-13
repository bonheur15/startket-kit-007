import path from "node:path";
import ts from "typescript";
import { env } from "../src/config/env";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type EndpointDescriptor = {
	functionName: string;
	importPath: string;
	routePath: string;
	routeAliases: string[];
	method: HttpMethod;
	inputTypeText: string;
	responseTypeText: string;
	inputSchemaExpr?: string;
	responseSchemaExpr: string;
	inputSource: "none" | "query" | "body";
	inputOptional: boolean;
	pathParamNames: string[];
};

const apiRoot = new URL("../src/api/", import.meta.url);
const engineGeneratedRoot = new URL("../.generated/", import.meta.url);
const webGeneratedRoot = new URL("../../web/.generated/", import.meta.url);
const projectRoot = new URL("../", import.meta.url);

function toPosixPath(value: string): string {
	return value.replaceAll("\\", "/");
}

function getSourceFiles(rootDir: string): string[] {
	return ts.sys
		.readDirectory(rootDir, [".ts"], undefined, ["**/index.ts"])
		.sort();
}

function detectMethod(functionName: string): HttpMethod {
	const lower = functionName.toLowerCase();

	if (
		lower.startsWith("create") ||
		lower.startsWith("post") ||
		lower.startsWith("add")
	) {
		return "POST";
	}

	if (lower.startsWith("update") || lower.startsWith("put")) {
		return "PUT";
	}

	if (lower.startsWith("patch")) {
		return "PATCH";
	}

	if (lower.startsWith("delete") || lower.startsWith("remove")) {
		return "DELETE";
	}

	return "GET";
}

function getRouteInfo(relativeFile: string) {
	const withoutIndex = toPosixPath(relativeFile).replace(/\/index\.ts$/, "");
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

function getExportedFunction(
	sourceFile: ts.SourceFile,
	checker: ts.TypeChecker,
): { declaration: ts.FunctionDeclaration; symbol: ts.Symbol } {
	const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

	if (!moduleSymbol) {
		throw new Error(`Failed to read module symbol for ${sourceFile.fileName}`);
	}

	for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
		const declaration = symbol
			.getDeclarations()
			?.find(ts.isFunctionDeclaration);

		if (declaration?.name) {
			return { declaration, symbol };
		}
	}

	throw new Error(
		`No exported function declaration found in ${sourceFile.fileName}`,
	);
}

function unwrapPromiseType(type: ts.Type): ts.Type {
	const reference = type as ts.TypeReference;

	if (
		type.getSymbol()?.getName() === "Promise" &&
		reference.typeArguments?.[0]
	) {
		return reference.typeArguments[0];
	}

	return type;
}

function removeUndefinedFromUnion(
	type: ts.Type,
	checker: ts.TypeChecker,
): ts.Type {
	if (!type.isUnion()) {
		return type;
	}

	const filtered = type.types.filter(
		(part) => (part.flags & ts.TypeFlags.Undefined) === 0,
	);

	if (filtered.length === 1) {
		return filtered[0];
	}

	return checker.getUnionType(filtered, ts.UnionReduction.None);
}

function schemaExprFromType(
	type: ts.Type,
	checker: ts.TypeChecker,
	purpose: "input" | "response",
): string {
	const typeName = checker.typeToString(type);

	// 1. Check for Date
	if (typeName === "Date" || type.getSymbol()?.getName() === "Date") {
		return "s.date()";
	}

	// 2. Check for Tuple types
	if (checker.isTupleType(type)) {
		const reference = type as ts.TypeReference;
		const elementTypes = reference.typeArguments ?? [];
		if (elementTypes.length === 0) {
			return "s.tuple([] as const)";
		}
		const members = elementTypes.map((part) =>
			schemaExprFromType(part, checker, purpose),
		);
		return `s.tuple([${members.join(", ")}] as const)`;
	}

	// 3. Check for Union types
	if (type.isUnion()) {
		const hasUndefined = type.types.some(
			(part) => (part.flags & ts.TypeFlags.Undefined) !== 0,
		);
		const hasNull = type.types.some(
			(part) => (part.flags & ts.TypeFlags.Null) !== 0,
		);

		if (hasUndefined) {
			const filtered = type.types.filter(
				(part) => (part.flags & ts.TypeFlags.Undefined) === 0,
			);
			const filteredType =
				filtered.length === 1
					? filtered[0]
					: checker.getUnionType(filtered, ts.UnionReduction.None);
			return `s.optional(${schemaExprFromType(filteredType, checker, purpose)})`;
		}

		if (hasNull) {
			const filtered = type.types.filter(
				(part) => (part.flags & ts.TypeFlags.Null) === 0,
			);
			const filteredType =
				filtered.length === 1
					? filtered[0]
					: checker.getUnionType(filtered, ts.UnionReduction.None);
			return `s.nullable(${schemaExprFromType(filteredType, checker, purpose)})`;
		}

		if (
			type.types.every(
				(part) => (part.flags & ts.TypeFlags.StringLiteral) !== 0,
			)
		) {
			const values = type.types.map((part) =>
				JSON.stringify((part as ts.StringLiteralType).value),
			);
			return `s.enum([${values.join(", ")}] as const)`;
		}

		if (
			type.types.length === 2 &&
			type.types.every(
				(part) => (part.flags & ts.TypeFlags.BooleanLiteral) !== 0,
			)
		) {
			return purpose === "input"
				? "s.boolean({ coerce: true })"
				: "s.boolean()";
		}

		const members = type.types.map((part) =>
			schemaExprFromType(part, checker, purpose),
		);
		return `s.union([${members.join(", ")}])`;
	}

	// 4. Check for Literal types & Primitives
	if ((type.flags & ts.TypeFlags.StringLiteral) !== 0) {
		return `s.literal(${JSON.stringify((type as ts.StringLiteralType).value)})`;
	}

	if ((type.flags & ts.TypeFlags.Any) !== 0) {
		throw new Error(
			`Type "any" is strictly forbidden (found in ${purpose} type). Please use strong typing.`,
		);
	}

	if ((type.flags & ts.TypeFlags.Unknown) !== 0) {
		throw new Error(
			`Type "unknown" is strictly forbidden (found in ${purpose} type). Please use strong typing.`,
		);
	}

	if ((type.flags & ts.TypeFlags.NumberLiteral) !== 0) {
		return `s.literal(${(type as ts.NumberLiteralType).value})`;
	}

	if ((type.flags & ts.TypeFlags.BooleanLiteral) !== 0) {
		return `s.literal(${checker.typeToString(type)})`;
	}

	if ((type.flags & ts.TypeFlags.String) !== 0) {
		return "s.string()";
	}

	if ((type.flags & ts.TypeFlags.Number) !== 0) {
		return purpose === "input" ? "s.number({ coerce: true })" : "s.number()";
	}

	if ((type.flags & ts.TypeFlags.Boolean) !== 0) {
		return purpose === "input" ? "s.boolean({ coerce: true })" : "s.boolean()";
	}

	// 5. Check for Arrays
	if (checker.isArrayType(type)) {
		const reference = type as ts.TypeReference;
		const itemType = reference.typeArguments?.[0];

		if (!itemType) {
			throw new Error(
				`Unable to resolve array item type for ${checker.typeToString(type)}`,
			);
		}

		return `s.array(${schemaExprFromType(itemType, checker, purpose)})`;
	}

	// 6. Check for Intersection types
	if (type.isIntersection()) {
		const properties = type.getProperties();
		const entries = properties.map((property) => {
			const declaration =
				property.valueDeclaration ?? property.declarations?.[0];

			if (!declaration) {
				throw new Error(
					`Unable to resolve declaration for property ${property.name}`,
				);
			}

			const propertyType = checker.getTypeOfSymbolAtLocation(
				property,
				declaration,
			);
			const isOptional =
				(property.getFlags() & ts.SymbolFlags.Optional) !== 0 ||
				(propertyType.isUnion() &&
					propertyType.types.some(
						(part) => (part.flags & ts.TypeFlags.Undefined) !== 0,
					));

			const baseType = removeUndefinedFromUnion(propertyType, checker);
			const inner = schemaExprFromType(baseType, checker, purpose);

			return `${JSON.stringify(property.name)}: ${isOptional ? `s.optional(${inner})` : inner}`;
		});

		return `s.object({ ${entries.join(", ")} })`;
	}

	// 7. Check for Record types (Object with index signature)
	const stringIndexType = checker.getIndexTypeOfType(type, ts.IndexKind.String);
	if (stringIndexType) {
		return `s.record(${schemaExprFromType(stringIndexType, checker, purpose)})`;
	}

	// 8. General Object properties check
	if ((type.flags & ts.TypeFlags.Object) !== 0) {
		const properties = type.getProperties();
		const entries = properties.map((property) => {
			const declaration =
				property.valueDeclaration ?? property.declarations?.[0];

			if (!declaration) {
				throw new Error(
					`Unable to resolve declaration for property ${property.name}`,
				);
			}

			const propertyType = checker.getTypeOfSymbolAtLocation(
				property,
				declaration,
			);
			const isOptional =
				(property.getFlags() & ts.SymbolFlags.Optional) !== 0 ||
				(propertyType.isUnion() &&
					propertyType.types.some(
						(part) => (part.flags & ts.TypeFlags.Undefined) !== 0,
					));

			const baseType = removeUndefinedFromUnion(propertyType, checker);
			const inner = schemaExprFromType(baseType, checker, purpose);

			return `${JSON.stringify(property.name)}: ${isOptional ? `s.optional(${inner})` : inner}`;
		});

		return `s.object({ ${entries.join(", ")} })`;
	}

	throw new Error(
		`Unsupported type for schema generation: ${checker.typeToString(type)}`,
	);
}

function typeTextFromType(type: ts.Type, checker: ts.TypeChecker): string {
	return checker.typeToString(
		type,
		undefined,
		ts.TypeFormatFlags.NoTruncation |
			ts.TypeFormatFlags.InTypeAlias |
			ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType,
	);
}

function pascalCase(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function getPreferredAlias(routePath: string): string {
	if (routePath.startsWith("/api/v1/system/")) {
		return routePath.replace("/api/v1/system", "");
	}

	if (routePath.startsWith("/api/v1/")) {
		return routePath.replace("/api/v1", "");
	}

	return routePath;
}

function getRouteAliases(routePath: string): string[] {
	const aliases = new Set<string>([routePath]);

	if (routePath.startsWith("/api/")) {
		aliases.add(routePath.slice(4));
	}

	const withoutApi = routePath.startsWith("/api/")
		? routePath.slice(4)
		: routePath;
	const versionedMatch = /^\/v\d+\/(.+)$/.exec(withoutApi);

	if (versionedMatch) {
		aliases.add(`/${versionedMatch[1]}`);

		const systemMatch = /^\/system\/(.+)$/.exec(`/${versionedMatch[1]}`);
		if (systemMatch) {
			aliases.add(`/${systemMatch[1]}`);
		}
	}

	const preferredAlias = getPreferredAlias(routePath);
	aliases.add(preferredAlias);

	return [...aliases];
}

function parseEndpoints(
	program: ts.Program,
	rootDir: string,
	sourceFiles: string[],
): EndpointDescriptor[] {
	const checker = program.getTypeChecker();

	const parsed = sourceFiles.map((fileName) => {
		const sourceFile = program.getSourceFile(fileName);

		if (!sourceFile) {
			throw new Error(`Unable to load source file ${fileName}`);
		}

		const { declaration, symbol } = getExportedFunction(sourceFile, checker);
		const functionName = declaration.name?.text;

		if (!functionName) {
			throw new Error(`Endpoint function in ${fileName} must be named`);
		}

		const functionType = checker.getTypeOfSymbolAtLocation(symbol, declaration);
		const signature = functionType.getCallSignatures()[0];

		if (!signature) {
			throw new Error(`Unable to resolve signature for ${functionName}`);
		}

		const parameterSymbol = signature.getParameters()[0];
		const parameterDeclaration = declaration.parameters[0];
		const inputType =
			parameterSymbol && parameterDeclaration
				? checker.getTypeOfSymbolAtLocation(
						parameterSymbol,
						parameterDeclaration,
					)
				: undefined;
		const responseType = unwrapPromiseType(
			checker.getReturnTypeOfSignature(signature),
		);
		const relativeFile = toPosixPath(path.relative(rootDir, fileName));
		const routeInfo = getRouteInfo(relativeFile);
		const method = detectMethod(functionName);

		return {
			functionName,
			importPath: `../src/api/${relativeFile.replace(/\/index\.ts$/, "")}`,
			routePath: routeInfo.routePath,
			routeAliases: [],
			method,
			inputTypeText: inputType
				? typeTextFromType(inputType, checker)
				: "undefined",
			responseTypeText: typeTextFromType(responseType, checker),
			inputSchemaExpr: inputType
				? schemaExprFromType(inputType, checker, "input")
				: undefined,
			responseSchemaExpr: schemaExprFromType(responseType, checker, "response"),
			inputSource: inputType
				? method === "GET" || method === "DELETE"
					? "query"
					: "body"
				: "none",
			inputOptional:
				parameterDeclaration?.questionToken !== undefined ||
				(inputType?.isUnion() &&
					inputType.types.some(
						(part) => (part.flags & ts.TypeFlags.Undefined) !== 0,
					)) ||
				inputType === undefined,
			pathParamNames: routeInfo.pathParamNames,
		};
	});

	for (const endpoint of parsed) {
		endpoint.routeAliases = getRouteAliases(endpoint.routePath);
	}

	return parsed;
}

function buildManifestFile(endpoints: EndpointDescriptor[]): string {
	return `/* eslint-disable */
import { s } from "../src/core/schema";
${endpoints
	.map(
		(endpoint, index) =>
			`import { ${endpoint.functionName} as handler${index + 1} } from "${endpoint.importPath}";`,
	)
	.join("\n")}

export const endpoints = [
${endpoints
	.map(
		(endpoint, index) => `  {
    operationId: ${JSON.stringify(endpoint.functionName)},
    method: ${JSON.stringify(endpoint.method)},
    path: ${JSON.stringify(endpoint.routePath)},
    inputSource: ${JSON.stringify(endpoint.inputSource)},
    inputOptional: ${JSON.stringify(endpoint.inputOptional)},
    pathParamNames: ${JSON.stringify(endpoint.pathParamNames)},
    inputSchema: ${endpoint.inputSchemaExpr ?? "undefined"},
    responseSchema: ${endpoint.responseSchemaExpr},
    handler: handler${index + 1},
  },`,
	)
	.join("\n")}
] as const;
`;
}

function buildWebClientFile(endpoints: EndpointDescriptor[]): string {
	return `/* eslint-disable */
import { apiRequest } from "../src/lib/api/client";

${endpoints
	.map((endpoint) => {
		const typeName = pascalCase(endpoint.functionName);

		return `export type ${typeName}Input = ${endpoint.inputTypeText};
export type ${typeName}Response = ${endpoint.responseTypeText};

export const ${typeName}Meta = {
  operationId: ${JSON.stringify(endpoint.functionName)},
  method: ${JSON.stringify(endpoint.method)},
  path: ${JSON.stringify(endpoint.routePath)},
} as const;

export async function ${endpoint.functionName}(input${endpoint.inputOptional || endpoint.inputSource === "none" ? "?" : ""}: ${typeName}Input, options?: { debug?: boolean }): Promise<${typeName}Response> {
  return apiRequest<${typeName}Response, ${typeName}Input>(${typeName}Meta, input, options);
}`;
	})
	.join("\n\n")}
`;
}

function buildWebHooksFile(endpoints: EndpointDescriptor[]): string {
	return `/* eslint-disable */
import { useApiQuery, type QueryOptions } from "../src/lib/api/hooks";
import {
${endpoints
	.map((endpoint) => {
		const typeName = pascalCase(endpoint.functionName);
		return `  ${typeName}Meta,\n  type ${typeName}Input,\n  type ${typeName}Response,`;
	})
	.join("\n")}
} from "./api-client";

${endpoints
	.map((endpoint) => {
		const typeName = pascalCase(endpoint.functionName);
		return `export function use${typeName}Query(
  input${endpoint.inputOptional || endpoint.inputSource === "none" ? "?" : ""}: ${typeName}Input,
  options?: QueryOptions<${typeName}Response>,
) {
  return useApiQuery<${typeName}Response, ${typeName}Input>(${typeName}Meta, input, options);
}`;
	})
	.join("\n\n")}
`;
}

function buildWebEngineFile(endpoints: EndpointDescriptor[]): string {
	const registryEntries = endpoints
		.flatMap((endpoint) =>
			endpoint.routeAliases.map((alias) => {
				const typeName = pascalCase(endpoint.functionName);

				return `  ${JSON.stringify(alias)}: ${typeName}Meta,`;
			}),
		)
		.join("\n");

	const pathMapEntries = endpoints
		.flatMap((endpoint) =>
			endpoint.routeAliases.map((alias) => {
				const typeName = pascalCase(endpoint.functionName);
				const hasInput = endpoint.inputTypeText !== "undefined";
				const isBodyMethod =
					endpoint.method === "POST" ||
					endpoint.method === "PUT" ||
					endpoint.method === "PATCH";

				let inputTypeStr = "undefined";
				if (hasInput) {
					if (isBodyMethod) {
						inputTypeStr = `{ body: ${typeName}Input; query?: never }`;
					} else {
						inputTypeStr = `{ query: ${typeName}Input; body?: never }`;
					}
				}

				return `  ${JSON.stringify(alias)}: {
    input: ${inputTypeStr};
    response: ${typeName}Response;
  };`;
			}),
		)
		.join("\n");

	return `/* eslint-disable */
import { apiRequest } from "../src/lib/api/client";
import { useApiQuery, type QueryOptions } from "../src/lib/api/hooks";
import {
${endpoints
	.map((endpoint) => {
		const typeName = pascalCase(endpoint.functionName);
		return `  ${typeName}Meta,\n  type ${typeName}Input,\n  type ${typeName}Response,`;
	})
	.join("\n")}
} from "./api-client";

export const engineRoutes = {
${registryEntries}
} as const;

type EngineTypeMap = {
${pathMapEntries}
};

export type EnginePath = keyof EngineTypeMap;
export type EngineInput<TPath extends EnginePath> =
  EngineTypeMap[TPath]["input"];
export type EngineResponse<TPath extends EnginePath> =
  EngineTypeMap[TPath]["response"];

export async function callEngine<TPath extends EnginePath>(
  path: TPath,
  input?: EngineInput<TPath>,
  options?: { debug?: boolean },
): Promise<EngineResponse<TPath>> {
  return apiRequest<EngineResponse<TPath>, EngineInput<TPath>>(
    engineRoutes[path],
    input,
    options,
  );
}

export function useEngine<TPath extends EnginePath>(
  path: TPath,
  input?: EngineInput<TPath>,
  options?: QueryOptions<EngineResponse<TPath>>,
) {
  return useApiQuery<EngineResponse<TPath>, EngineInput<TPath>>(
    engineRoutes[path],
    input,
    options,
  );
}
`;
}

async function generateAll(
	program: ts.Program,
	rootDir: string,
	sourceFiles: string[],
) {
	const endpoints = parseEndpoints(program, rootDir, sourceFiles);

	await Bun.write(
		new URL("endpoints.ts", engineGeneratedRoot),
		buildManifestFile(endpoints),
	);
	const { createOpenApiDocument } = await import("../src/core/api/runtime.ts");
	const generatedModule = (await import(
		new URL(`../.generated/endpoints.ts?ts=${Date.now()}`, import.meta.url).href
	)) as {
		endpoints: Array<unknown>;
	};
	const openapiDocument = createOpenApiDocument(
		generatedModule.endpoints as never[],
	);
	await Bun.write(
		new URL("openapi-document.ts", engineGeneratedRoot),
		`/* eslint-disable */\nexport const openapiDocument = ${JSON.stringify(openapiDocument, null, 2)} as const;\n`,
	);
	await Bun.write(
		new URL("api-client.ts", webGeneratedRoot),
		buildWebClientFile(endpoints),
	);
	await Bun.write(
		new URL("api-hooks.ts", webGeneratedRoot),
		buildWebHooksFile(endpoints),
	);
	await Bun.write(
		new URL("engine.ts", webGeneratedRoot),
		buildWebEngineFile(endpoints),
	);
	await Bun.write(
		new URL("../openapi.json", projectRoot),
		`${JSON.stringify(openapiDocument, null, 2)}\n`,
	);

	console.log(
		`Generated ${endpoints.length} function-first endpoints for ${env.appName}`,
	);
}

async function main() {
	const isWatch = process.argv.includes("--watch");
	const rootDir = Bun.fileURLToPath(apiRoot);

	if (isWatch) {
		const configPath = ts.findConfigFile(
			Bun.fileURLToPath(projectRoot),
			ts.sys.fileExists,
			"tsconfig.json",
		);
		if (!configPath) {
			throw new Error("Could not find tsconfig.json");
		}

		const host = ts.createWatchCompilerHost(
			configPath,
			{},
			ts.sys,
			ts.createSemanticDiagnosticsBuilderProgram,
			(diagnostic) => {
				console.error(
					ts.flattenDiagnosticMessageText(diagnostic.messageText, "\\n"),
				);
			},
			() => {}, // Ignore watch status changes to keep output clean
		);

		const origPostProgramCreate = host.afterProgramCreate;
		host.afterProgramCreate = (builderProgram) => {
			const sourceFiles = getSourceFiles(rootDir);
			generateAll(builderProgram.getProgram(), rootDir, sourceFiles).catch(
				(err) => {
					console.error("Failed to generate endpoints:", err);
				},
			);
			if (origPostProgramCreate) {
				origPostProgramCreate(builderProgram);
			}
		};

		console.log("Starting generator in AST watch mode...");
		ts.createWatchProgram(host);
	} else {
		const sourceFiles = getSourceFiles(rootDir);
		const program = ts.createProgram(sourceFiles, {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			allowImportingTsExtensions: true,
			strict: true,
			skipLibCheck: true,
		});
		await generateAll(program, rootDir, sourceFiles);
	}
}

await main();
