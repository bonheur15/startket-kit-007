/**
 * Exercise every supported input/output type.
 * @tag examples
 */
export type ComplexInput = {
	unionField: string | number | null | undefined;
	intersectionField: { id: string } & { name: string; age?: number };
	recordField: Record<string, { role: "admin" | "user"; joinedAt: Date }>;
	dateField: Date;
	arrayField: { sku: string; price: number }[];
	tupleField: [string, number];
};

export type ComplexResponse = {
	status: "success" | "error";
	processedAt: Date;
	result: {
		echoedUnion: string | number | null;
		mergedInfo: { id: string; name: string; age?: number };
		recordSummary: Record<string, string>;
		itemCount: number;
		tupleValue: [string, number];
	};
};

/**
 * Echo a complex payload back.
 * Demonstrates unions, intersections, records, dates, arrays and tuples.
 * @tag examples
 */
export function postExampleComplex(input: ComplexInput): ComplexResponse {
	const summary: Record<string, string> = {};
	for (const [key, value] of Object.entries(input.recordField)) {
		summary[key] = `${value.role} joined at ${value.joinedAt.toISOString()}`;
	}

	return {
		status: "success",
		processedAt: new Date(),
		result: {
			echoedUnion: input.unionField ?? null,
			mergedInfo: input.intersectionField,
			recordSummary: summary,
			itemCount: input.arrayField.length,
			tupleValue: input.tupleField,
		},
	};
}
