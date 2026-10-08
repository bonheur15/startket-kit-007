export type OpenApiSchema =
	| {
			type: "string" | "number" | "boolean" | "object" | "array";
			description?: string;
			enum?: string[];
			nullable?: boolean;
			properties?: Record<string, OpenApiSchema>;
			required?: string[];
			items?: OpenApiSchema;
			additionalProperties?: boolean;
	  }
	| {
			const: string | number | boolean | null;
			type?: "string" | "number" | "boolean";
			description?: string;
			nullable?: boolean;
	  }
	| {
			oneOf: OpenApiSchema[];
			description?: string;
			nullable?: boolean;
	  }
	| Record<string, unknown>;

type ParseSuccess<T> = {
	success: true;
	data: T;
};

type ParseFailure = {
	success: false;
	issues: string[];
};

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export interface Schema<T> {
	readonly tsType: string;
	readonly openapi: OpenApiSchema;
	parse(input: unknown, path?: string): T;
	safeParse(input: unknown, path?: string): ParseResult<T>;
}

export type InferSchema<TSchema extends Schema<unknown>> =
	TSchema extends Schema<infer TValue> ? TValue : never;

export class SchemaError extends Error {
	readonly issues: string[];

	constructor(issues: string[]) {
		super(issues[0] ?? "Schema validation failed");
		this.name = "SchemaError";
		this.issues = issues;
	}
}

function createSchema<T>(
	tsType: string,
	openapi: OpenApiSchema,
	parser: (input: unknown, path: string) => T,
): Schema<T> {
	return {
		tsType,
		openapi,
		parse(input: unknown, path = "$") {
			return parser(input, path);
		},
		safeParse(input: unknown, path = "$") {
			try {
				return {
					success: true,
					data: parser(input, path),
				};
			} catch (error) {
				if (error instanceof SchemaError) {
					return {
						success: false,
						issues: error.issues,
					};
				}

				throw error;
			}
		},
	};
}

function fail(path: string, message: string): never {
	throw new SchemaError([`${path}: ${message}`]);
}

type StringOptions = {
	description?: string;
	minLength?: number;
	maxLength?: number;
};

type NumberOptions = {
	description?: string;
	coerce?: boolean;
	integer?: boolean;
};

type BooleanOptions = {
	description?: string;
	coerce?: boolean;
};

type ObjectShape = Record<string, Schema<unknown>>;

type InferObjectShape<TShape extends ObjectShape> = {
	[TKey in keyof TShape]: InferSchema<TShape[TKey]>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinIssues(path: string, error: unknown): never {
	if (error instanceof SchemaError) {
		throw error;
	}

	fail(path, "invalid value");
}

export const s = {
	/** Accepts `undefined` or `null`. Used for endpoints that return nothing. */
	void() {
		return createSchema<void>(
			"void",
			{ nullable: true, description: "No content" },
			(input, path) => {
				if (input === undefined || input === null) return undefined;
				fail(path, "expected no value");
			},
		);
	},

	unknown(options: { description?: string } = {}) {
		return createSchema<unknown>(
			"unknown",
			{
				description: options.description ?? "Arbitrary value",
			},
			(input) => input,
		);
	},

	any(options: { description?: string } = {}) {
		// biome-ignore lint/suspicious/noExplicitAny: 'any' is an intentional schema builder type
		return createSchema<any>(
			"any",
			{
				description: options.description ?? "Arbitrary value",
			},
			(input) => input,
		);
	},

	string(options: StringOptions = {}) {
		return createSchema<string>(
			"string",
			{
				type: "string",
				description: options.description,
			},
			(input, path) => {
				if (typeof input !== "string") {
					fail(path, "expected string");
				}

				if (
					options.minLength !== undefined &&
					input.length < options.minLength
				) {
					fail(path, `expected string length >= ${options.minLength}`);
				}

				if (
					options.maxLength !== undefined &&
					input.length > options.maxLength
				) {
					fail(path, `expected string length <= ${options.maxLength}`);
				}

				return input;
			},
		);
	},

	number(options: NumberOptions = {}) {
		return createSchema<number>(
			"number",
			{
				type: "number",
				description: options.description,
			},
			(input, path) => {
				const value =
					options.coerce && typeof input === "string" && input.trim() !== ""
						? Number(input)
						: input;

				if (typeof value !== "number" || Number.isNaN(value)) {
					fail(path, "expected number");
				}

				if (options.integer && !Number.isInteger(value)) {
					fail(path, "expected integer");
				}

				return value;
			},
		);
	},

	boolean(options: BooleanOptions = {}) {
		return createSchema<boolean>(
			"boolean",
			{
				type: "boolean",
				description: options.description,
			},
			(input, path) => {
				if (typeof input === "boolean") {
					return input;
				}

				if (options.coerce && typeof input === "string") {
					if (input === "true") {
						return true;
					}

					if (input === "false") {
						return false;
					}
				}

				fail(path, "expected boolean");
			},
		);
	},

	literal<TValue extends string | number | boolean | null>(value: TValue) {
		const literalType =
			value === null
				? "null"
				: typeof value === "string"
					? "string"
					: typeof value === "number"
						? "number"
						: "boolean";

		return createSchema<TValue>(
			value === null ? "null" : JSON.stringify(value),
			{
				const: value,
				type: literalType === "null" ? undefined : literalType,
			},
			(input, path) => {
				if (input !== value) {
					fail(path, `expected literal ${JSON.stringify(value)}`);
				}

				return value;
			},
		);
	},

	enum<const TValues extends readonly string[]>(
		values: TValues,
		options: { description?: string } = {},
	) {
		return createSchema<TValues[number]>(
			values.map((value) => JSON.stringify(value)).join(" | "),
			{
				type: "string",
				enum: [...values],
				description: options.description,
			},
			(input, path) => {
				if (typeof input !== "string" || !values.includes(input)) {
					fail(path, `expected one of ${values.join(", ")}`);
				}

				return input;
			},
		);
	},

	array<TItem>(item: Schema<TItem>, options: { description?: string } = {}) {
		return createSchema<TItem[]>(
			`Array<${item.tsType}>`,
			{
				type: "array",
				items: item.openapi,
				description: options.description,
			},
			(input, path) => {
				if (!Array.isArray(input)) {
					fail(path, "expected array");
				}

				return input.map((entry, index) =>
					item.parse(entry, `${path}[${index}]`),
				);
			},
		);
	},

	object<TShape extends ObjectShape>(
		shape: TShape,
		options: { description?: string } = {},
	) {
		const properties: Record<string, OpenApiSchema> = {};
		const required: string[] = [];

		for (const [key, schema] of Object.entries(shape)) {
			properties[key] = schema.openapi;
			if (!schema.tsType.endsWith(" | undefined")) {
				required.push(key);
			}
		}

		return createSchema<InferObjectShape<TShape>>(
			`{ ${Object.entries(shape)
				.map(([key, schema]) =>
					schema.tsType.endsWith(" | undefined")
						? `${JSON.stringify(key)}?: ${schema.tsType.replace(" | undefined", "")}`
						: `${JSON.stringify(key)}: ${schema.tsType}`,
				)
				.join("; ")} }`,
			{
				type: "object",
				properties,
				required,
				additionalProperties: false,
				description: options.description,
			},
			(input, path) => {
				if (!isPlainObject(input)) {
					fail(path, "expected object");
				}

				const result: Record<string, unknown> = {};

				for (const [key, schema] of Object.entries(shape)) {
					const value = input[key];

					try {
						result[key] = schema.parse(value, `${path}.${key}`);
					} catch (error) {
						joinIssues(`${path}.${key}`, error);
					}
				}

				return result as InferObjectShape<TShape>;
			},
		);
	},

	optional<TValue>(schema: Schema<TValue>) {
		return createSchema<TValue | undefined>(
			`${schema.tsType} | undefined`,
			{
				...schema.openapi,
			},
			(input, path) => {
				if (input === undefined) {
					return undefined;
				}

				return schema.parse(input, path);
			},
		);
	},

	nullable<TValue>(schema: Schema<TValue>) {
		return createSchema<TValue | null>(
			`${schema.tsType} | null`,
			{
				...schema.openapi,
				nullable: true,
			},
			(input, path) => {
				if (input === null) {
					return null;
				}

				return schema.parse(input, path);
			},
		);
	},

	union<const TMembers extends readonly Schema<unknown>[]>(
		members: TMembers,
		options: { description?: string } = {},
	) {
		return createSchema<InferSchema<TMembers[number]>>(
			members.map((member) => member.tsType).join(" | "),
			{
				oneOf: members.map((member) => member.openapi),
				description: options.description,
			},
			(input, path) => {
				const issues: string[] = [];
				for (const member of members) {
					const res = member.safeParse(input, path);
					if (res.success) {
						return res.data as InferSchema<TMembers[number]>;
					}
					issues.push(...res.issues);
				}
				fail(
					path,
					`expected union, got validation failures:\n${issues.join("\n")}`,
				);
			},
		);
	},

	record<TValue>(
		valueSchema: Schema<TValue>,
		options: { description?: string } = {},
	) {
		return createSchema<Record<string, TValue>>(
			`Record<string, ${valueSchema.tsType}>`,
			{
				type: "object",
				additionalProperties: valueSchema.openapi,
				description: options.description,
			},
			(input, path) => {
				if (!isPlainObject(input)) {
					fail(path, "expected object");
				}

				const result: Record<string, TValue> = {};
				for (const [key, val] of Object.entries(input)) {
					try {
						result[key] = valueSchema.parse(val, `${path}.${key}`);
					} catch (error) {
						joinIssues(`${path}.${key}`, error);
					}
				}
				return result;
			},
		);
	},

	date(options: { description?: string } = {}) {
		return createSchema<Date>(
			"Date",
			{
				type: "string",
				description: options.description ?? "Date string",
			},
			(input, path) => {
				if (input instanceof Date) {
					return input;
				}
				if (typeof input !== "string" && typeof input !== "number") {
					fail(path, "expected date string or timestamp");
				}
				const parsed = new Date(input);
				if (Number.isNaN(parsed.getTime())) {
					fail(path, "invalid date format");
				}
				return parsed;
			},
		);
	},

	tuple<const TMembers extends readonly Schema<unknown>[]>(
		members: TMembers,
		options: { description?: string } = {},
	) {
		return createSchema<{
			[TIndex in keyof TMembers]: InferSchema<TMembers[TIndex]>;
		}>(
			`[${members.map((member) => member.tsType).join(", ")}]`,
			{
				type: "array",
				items: {
					oneOf: members.map((member) => member.openapi),
				},
				description: options.description,
			},
			(input, path) => {
				if (!Array.isArray(input)) {
					fail(path, "expected array");
				}

				if (input.length !== members.length) {
					fail(
						path,
						`expected tuple of length ${members.length}, got ${input.length}`,
					);
				}

				const parsed = members.map((member, index) =>
					member.parse(input[index], `${path}[${index}]`),
				);
				// biome-ignore lint/suspicious/noExplicitAny: tuple type cast requires any
				return parsed as any;
			},
		);
	},
};
