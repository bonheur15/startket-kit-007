/**
 * Minimal GET endpoint with an optional boolean query flag.
 * @tag examples
 */
export function getExampleSimple(input?: { flag?: boolean }) {
	return {
		active: input?.flag ?? false,
		timestamp: new Date().toISOString(),
	};
}
