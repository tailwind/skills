import { MCP_SERVER_URL } from "../generated/connect-facts";
import type { Env } from "./env";
import { opencodeConfigCandidates } from "./paths";

/**
 * What the user's global OpenCode config already says about a server named
 * `tailwind`. Read-only: every write goes through `opencode mcp add`.
 */
export type OpencodeEntryState =
	| Readonly<{ kind: "absent" }>
	| Readonly<{ kind: "matches"; path: string }>
	| Readonly<{ kind: "conflict"; path: string; url: string | undefined }>
	| Readonly<{ kind: "unreadable"; path: string }>;

/**
 * Strips `//` and `/* *\/` comments so a JSONC config can be read with
 * `JSON.parse`. Deliberately not a full JSONC parser — trailing commas and
 * other JSONC-isms still fail to parse, and that is fine: every failure lands
 * in the `unreadable` branch, which refuses to write. A bug here costs the
 * user an automated install, never their existing config.
 *
 * String literals are tracked so a `//` inside a URL survives.
 */
export function stripJsonComments(source: string): string {
	let result = "";
	let index = 0;
	let inString = false;

	while (index < source.length) {
		const char = source[index];
		const next = source[index + 1];

		if (inString) {
			// A backslash escapes the next character, including a quote, so both
			// are copied before the quote test can see it.
			if (char === "\\") {
				result += source.slice(index, index + 2);
				index += 2;
				continue;
			}
			if (char === '"') inString = false;
			result += char;
			index += 1;
			continue;
		}

		if (char === '"') {
			inString = true;
			result += char;
			index += 1;
			continue;
		}

		if (char === "/" && next === "/") {
			while (index < source.length && source[index] !== "\n") index += 1;
			continue;
		}

		if (char === "/" && next === "*") {
			index += 2;
			while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
				index += 1;
			}
			index += 2;
			continue;
		}

		result += char;
		index += 1;
	}

	return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readEntryUrl(parsed: unknown): { present: boolean; url: string | undefined } {
	if (!isPlainObject(parsed)) return { present: false, url: undefined };

	const mcp = parsed.mcp;
	if (!isPlainObject(mcp)) return { present: false, url: undefined };

	const entry = mcp.tailwind;
	if (entry === undefined) return { present: false, url: undefined };
	if (!isPlainObject(entry)) return { present: true, url: undefined };

	const url = entry.url;
	return { present: true, url: typeof url === "string" ? url : undefined };
}

/**
 * Inspects the global OpenCode config for an existing `mcp.tailwind` entry.
 *
 * `opencode mcp add` replaces the whole entry without warning, unlike
 * `claude mcp add` and `codex mcp add`, which refuse when a server of that name
 * exists. That difference is why this check exists: without it the installer
 * would silently overwrite a `tailwind` server pointing somewhere else, and
 * would drop any keys (`enabled`, `timeout`) a user added to ours.
 */
export async function inspectOpencodeConfig(env: Env, home: string): Promise<OpencodeEntryState> {
	for (const candidate of opencodeConfigCandidates(home, env)) {
		const raw = await env.readFile(candidate);
		if (raw === undefined) continue;

		let parsed: unknown;
		try {
			parsed = JSON.parse(stripJsonComments(raw));
		} catch {
			return { kind: "unreadable", path: candidate };
		}

		const { present, url } = readEntryUrl(parsed);
		if (!present) return { kind: "absent" };
		return url === MCP_SERVER_URL
			? { kind: "matches", path: candidate }
			: { kind: "conflict", path: candidate, url };
	}

	return { kind: "absent" };
}
