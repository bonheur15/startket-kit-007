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

export function postHeavyTestComplex(input: ComplexInput): ComplexResponse {
	const summary: Record<string, string> = {};
	for (const [key, val] of Object.entries(input.recordField)) {
		summary[key] = `${val.role} joined at ${val.joinedAt.toISOString()}`;
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

export function getHeavyTestSimple(input?: { flag?: boolean }) {
	return {
		active: input?.flag ?? false,
		timestamp: new Date().toISOString(),
	};
}
