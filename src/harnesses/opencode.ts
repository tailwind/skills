import { MCP_SERVER_URL, OPENCODE_MCP_ADD_ARGS } from "../generated/connect-facts";
import { commandExists, dirExists } from "../lib/detect";
import type { Env } from "../lib/env";
import { inspectOpencodeConfig } from "../lib/opencode-config";
import { opencodeHomeDir, opencodeSkillPath } from "../lib/paths";
import type { HarnessAdapter, HarnessInstallResult, InstallOptions, StepResult } from "./types";
import { writeSkillFiles } from "./write-skill-file";

const MANUAL_COMMAND = `opencode ${OPENCODE_MCP_ADD_ARGS.join(" ")}`;

/**
 * Unlike Claude Code and Codex, `opencode mcp add` never refuses: it rewrites
 * `mcp.tailwind` in place and exits 0. So the decision of whether writing is
 * safe is made here, from the config, before the command runs.
 */
async function addMcpServer(env: Env, home: string, dryRun: boolean): Promise<StepResult> {
	const existing = await inspectOpencodeConfig(env, home);

	if (existing.kind === "conflict") {
		return {
			action: "mcp config",
			path: existing.path,
			status: "failed",
			detail: `a different MCP server named tailwind is already configured${
				existing.url ? ` (${existing.url})` : ""
			} and was left alone. Point it at ${MCP_SERVER_URL}, or remove it and re-run`,
		};
	}

	if (existing.kind === "unreadable") {
		return {
			action: "mcp config",
			path: existing.path,
			status: "failed",
			// Refusing rather than adding: `opencode mcp add` would rewrite the
			// entry regardless, and we cannot tell from an unparseable file whether
			// that would destroy a server pointing somewhere else.
			detail: `it could not be parsed as JSON or JSONC, so it was left untouched — an existing tailwind server could not be ruled out. Fix the file and re-run, or add the server yourself with \`${MANUAL_COMMAND}\``,
		};
	}

	// Re-adding would replace the whole entry, dropping any keys the user added
	// to it (`enabled`, `timeout`). Nothing needs writing, so nothing is.
	if (existing.kind === "matches") {
		return {
			action: "mcp config",
			path: existing.path,
			status: "skipped",
			detail: "tailwind MCP server is already configured",
		};
	}

	if (dryRun) {
		return { action: "mcp config", status: "would-write", detail: MANUAL_COMMAND };
	}

	const result = await env.execFile("opencode", OPENCODE_MCP_ADD_ARGS);
	if (result.code === 0) {
		return { action: "mcp config", status: "written", detail: MANUAL_COMMAND };
	}

	return {
		action: "mcp config",
		status: "failed",
		detail:
			result.stderr.trim() ||
			result.stdout.trim() ||
			`opencode mcp add exited with code ${result.code}`,
	};
}

export const opencodeAdapter: HarnessAdapter = {
	id: "opencode",
	label: "OpenCode",
	skillPath: opencodeSkillPath,
	async detect(env, home) {
		return (
			(await commandExists(env, "opencode")) || (await dirExists(env, opencodeHomeDir(home, env)))
		);
	},
	async install(env: Env, { home, skills, dryRun }: InstallOptions): Promise<HarnessInstallResult> {
		const steps: StepResult[] = [
			...(await writeSkillFiles(
				env,
				skills,
				(directoryName) => opencodeSkillPath(home, directoryName, env),
				dryRun,
			)),
			await addMcpServer(env, home, dryRun),
		];

		return {
			id: "opencode",
			label: "OpenCode",
			steps,
			ok: steps.every((step) => step.status !== "failed"),
			// OpenCode discovers the OAuth flow on its own when a tool first hits a
			// 401, but naming the command means the user can authenticate up front
			// rather than meeting an error mid-session.
			//
			// The project-config caveat matters because we only ever inspect and
			// write the global config: OpenCode also reads a project-local
			// opencode.json (or .opencode/opencode.json) that overrides it, and we
			// have no reliable way to locate one from here — so a project-scoped
			// tailwind entry can silently shadow the one this step just wrote,
			// making the install look successful when it is not.
			restartGuidance:
				"Run `opencode mcp auth tailwind` to authenticate, then restart OpenCode — it reads its MCP config at startup. If this project has its own opencode.json (or .opencode/opencode.json) with a tailwind entry, that one wins over the global config this installer writes — check there first if Tailwind still won't connect.",
		};
	},
};
