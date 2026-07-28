import { CURSOR_MCP_SERVER_CONFIG } from "../generated/connect-facts";

export type CursorMergeResult =
	| Readonly<{ ok: true; content: string }>
	| Readonly<{ ok: false; reason: string }>;

/**
 * Merges the Tailwind MCP server into an existing (or absent) Cursor
 * `mcp.json`. This is the single most important correctness rule in the
 * package: it must touch ONLY `mcpServers.tailwind`, leaving every other
 * server and every other top-level key exactly as the user had them.
 *
 * - `existingRaw === undefined` (file absent): produces a fresh file with
 *   just our entry.
 * - `existingRaw` is valid JSON: merges non-destructively.
 * - `existingRaw` fails to parse: returns `ok: false` rather than guessing —
 *   callers must leave the file untouched and surface the problem, never
 *   overwrite a file they couldn't understand.
 */
export function mergeCursorMcpConfig(existingRaw: string | undefined): CursorMergeResult {
	let parsed: Record<string, unknown> = {};

	if (existingRaw !== undefined) {
		let value: unknown;
		try {
			value = JSON.parse(existingRaw);
		} catch {
			return { ok: false, reason: "the file contains invalid JSON" };
		}

		if (value === null || typeof value !== "object" || Array.isArray(value)) {
			return { ok: false, reason: "the file's top level is not a JSON object" };
		}

		parsed = value as Record<string, unknown>;
	}

	const existingServersValue = parsed.mcpServers;
	const existingServers: Record<string, unknown> =
		existingServersValue !== null &&
		typeof existingServersValue === "object" &&
		!Array.isArray(existingServersValue)
			? (existingServersValue as Record<string, unknown>)
			: {};

	const merged = {
		...parsed,
		mcpServers: {
			...existingServers,
			tailwind: { ...CURSOR_MCP_SERVER_CONFIG },
		},
	};

	return { ok: true, content: `${JSON.stringify(merged, null, 2)}\n` };
}
