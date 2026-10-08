import { describe, expect, test } from "bun:test";
import { SchemaError, s } from "./index";

describe("schema", () => {
	test("coerces query-string primitives", () => {
		const schema = s.object({
			enabled: s.boolean({ coerce: true }),
			count: s.number({ coerce: true, integer: true }),
		});
		expect(schema.parse({ enabled: "true", count: "3" })).toEqual({
			enabled: true,
			count: 3,
		});
	});

	test("reports the failing path", () => {
		const schema = s.object({ nested: s.object({ value: s.number() }) });
		expect(() => schema.parse({ nested: { value: "x" } })).toThrow(SchemaError);
		const result = schema.safeParse({ nested: { value: "x" } });
		expect(result.success).toBe(false);
		if (!result.success) expect(result.issues[0]).toContain("$.nested.value");
	});

	test("strips unknown keys from objects", () => {
		const schema = s.object({ a: s.string() });
		expect(schema.parse({ a: "x", b: "y" })).toEqual({ a: "x" });
	});

	test("void accepts undefined and null only", () => {
		expect(s.void().parse(undefined)).toBeUndefined();
		expect(s.void().parse(null)).toBeUndefined();
		expect(() => s.void().parse("x")).toThrow(SchemaError);
	});

	test("dates accept ISO strings and timestamps", () => {
		expect(s.date().parse("2026-01-01T00:00:00.000Z")).toBeInstanceOf(Date);
		expect(s.date().parse(0).getTime()).toBe(0);
		expect(() => s.date().parse("not a date")).toThrow(SchemaError);
	});

	test("unions try each member and aggregate failures", () => {
		const schema = s.union([s.string(), s.number()]);
		expect(schema.parse("a")).toBe("a");
		expect(schema.parse(1)).toBe(1);
		expect(() => schema.parse(true)).toThrow(SchemaError);
	});
});
