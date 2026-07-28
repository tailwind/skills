import { MCP_SERVER_URL } from "../generated/connect-facts";
import type { StepResult } from "../harnesses/types";
import type { Env } from "./env";

/**
 * `claude mcp add` and `codex mcp add` both fail rather than overwrite when a
 * server of that name is already registered. That failure is the expected shape
 * of a second, idempotent run.
 */
export function isAlreadyExistsFailure(output: string): boolean {
	return /already exists/i.test(output);
}

/**
 * Decides what an "already exists" failure actually means.
 *
 * It has two very different causes: the user re-running the installer, and a
 * server called `tailwind` that points somewhere else entirely. Treating both
 * as success meant the installer could exit 0, print restart and login
 * guidance, and leave Tailwind unreachable — the worst kind of failure, because
 * it looks like success.
 *
 * Queried rather than assumed. When the entry cannot be read at all — an older
 * CLI without `mcp get`, say — the result says so instead of claiming either
 * outcome.
 */
export async function describeExistingServer(
	env: Env,
	command: string,
	serverName: string,
	removeHint: string,
): Promise<StepResult> {
	const probe = await env.execFile(command, ["mcp", "get", serverName]);
	const output = `${probe.stdout}\n${probe.stderr}`;

	if (probe.code !== 0) {
		return {
			action: "mcp config",
			status: "skipped",
			detail: `a server named ${serverName} is already configured, but its settings could not be read — check that it points at ${MCP_SERVER_URL}`,
		};
	}

	if (!output.includes(MCP_SERVER_URL)) {
		return {
			action: "mcp config",
			status: "failed",
			detail: `a different MCP server named ${serverName} is already configured and was left alone. Point it at ${MCP_SERVER_URL}, or remove it with \`${removeHint}\` and re-run`,
		};
	}

	return {
		action: "mcp config",
		status: "skipped",
		detail: `${serverName} MCP server is already configured`,
	};
}
