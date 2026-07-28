import { CLAUDE_CODE_MCP_ADD_ARGS } from "../generated/connect-facts";
import { commandExists, dirExists } from "../lib/detect";
import type { Env } from "../lib/env";
import { claudeCodeHomeDir, claudeCodeSkillPath } from "../lib/paths";
import type { HarnessAdapter, HarnessInstallResult, InstallOptions, StepResult } from "./types";
import { writeSkillFile } from "./write-skill-file";

/**
 * `claude mcp add` fails (non-zero exit) when a server with this name is
 * already registered — it does not overwrite. That failure is the expected
 * shape of a second, idempotent run, so it must be treated as success, not
 * surfaced as an error.
 */
export function isAlreadyExistsFailure(output: string): boolean {
	return /already exists/i.test(output);
}

async function addMcpServer(env: Env, dryRun: boolean): Promise<StepResult> {
	const commandPreview = `claude ${CLAUDE_CODE_MCP_ADD_ARGS.join(" ")}`;

	if (dryRun) {
		return { action: "mcp config", status: "would-write", detail: commandPreview };
	}

	const result = await env.execFile("claude", CLAUDE_CODE_MCP_ADD_ARGS);
	if (result.code === 0) {
		return { action: "mcp config", status: "written", detail: commandPreview };
	}

	if (isAlreadyExistsFailure(`${result.stdout}\n${result.stderr}`)) {
		return {
			action: "mcp config",
			status: "skipped",
			detail: "tailwind MCP server is already configured",
		};
	}

	return {
		action: "mcp config",
		status: "failed",
		detail:
			result.stderr.trim() ||
			result.stdout.trim() ||
			`claude mcp add exited with code ${result.code}`,
	};
}

export const claudeCodeAdapter: HarnessAdapter = {
	id: "claude-code",
	label: "Claude Code",
	skillPath: claudeCodeSkillPath,
	async detect(env, home) {
		return (await commandExists(env, "claude")) || (await dirExists(env, claudeCodeHomeDir(home)));
	},
	async install(
		env: Env,
		{ home, skillMarkdown, dryRun }: InstallOptions,
	): Promise<HarnessInstallResult> {
		const steps: StepResult[] = [
			await writeSkillFile(env, claudeCodeSkillPath(home), skillMarkdown, dryRun),
			await addMcpServer(env, dryRun),
		];

		return {
			id: "claude-code",
			label: "Claude Code",
			steps,
			ok: steps.every((step) => step.status !== "failed"),
			restartGuidance:
				"Claude Code picks up new skills live. The MCP server is read at startup — restart Claude Code, or run /mcp, to pick up the new connection.",
		};
	},
};
