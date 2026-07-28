/** Remote MCP servers need this Codex CLI version or later. */
export const CODEX_MIN_VERSION = "0.77.0";

/**
 * Pulls the first semver-looking substring out of `codex --version` output.
 * The exact output format isn't guaranteed across Codex releases, so this
 * scans loosely rather than anchoring to a specific prefix. Returns `null`
 * when nothing semver-shaped is found — callers must treat that as "unknown,
 * proceed silently," not as a failure.
 */
export function parseCodexVersion(output: string): string | null {
	const match = output.match(/\d+\.\d+\.\d+/);
	return match ? match[0] : null;
}

function versionParts(version: string): [number, number, number] {
	const [major, minor, patch] = version.split(".").map((part) => Number.parseInt(part, 10));
	return [major ?? 0, minor ?? 0, patch ?? 0];
}

export function isBelowMinimumVersion(
	version: string,
	minimum: string = CODEX_MIN_VERSION,
): boolean {
	const a = versionParts(version);
	const b = versionParts(minimum);
	for (let index = 0; index < 3; index += 1) {
		const aPart = a[index] ?? 0;
		const bPart = b[index] ?? 0;
		if (aPart !== bPart) return aPart < bPart;
	}
	return false;
}
