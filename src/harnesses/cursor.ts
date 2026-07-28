import path from "node:path";

import { mergeCursorMcpConfig } from "../lib/cursor-config";
import { dirExists } from "../lib/detect";
import type { Env } from "../lib/env";
import { cursorHomeDir, cursorMcpConfigPath, cursorSkillPath } from "../lib/paths";
import type { HarnessAdapter, HarnessInstallResult, InstallOptions, StepResult } from "./types";
import { writeSkillFile } from "./write-skill-file";

async function writeMcpConfig(env: Env, home: string, dryRun: boolean): Promise<StepResult> {
	const configPath = cursorMcpConfigPath(home);
	const existingRaw = await env.readFile(configPath);
	const merge = mergeCursorMcpConfig(existingRaw);

	if (!merge.ok) {
		return {
			action: "mcp config",
			path: configPath,
			status: "failed",
			detail: `${configPath} — ${merge.reason}; left untouched. Fix or remove the file, then re-run.`,
		};
	}

	if (dryRun) {
		return { action: "mcp config", path: configPath, status: "would-write" };
	}

	await env.mkdir(path.dirname(configPath));
	await env.writeFile(configPath, merge.content);
	return { action: "mcp config", path: configPath, status: "written" };
}

export const cursorAdapter: HarnessAdapter = {
	id: "cursor",
	label: "Cursor",
	skillPath: cursorSkillPath,
	async detect(env, home) {
		return dirExists(env, cursorHomeDir(home));
	},
	async install(
		env: Env,
		{ home, skillMarkdown, dryRun }: InstallOptions,
	): Promise<HarnessInstallResult> {
		const steps: StepResult[] = [
			await writeSkillFile(env, cursorSkillPath(home), skillMarkdown, dryRun),
			await writeMcpConfig(env, home, dryRun),
		];

		return {
			id: "cursor",
			label: "Cursor",
			steps,
			ok: steps.every((step) => step.status !== "failed"),
			restartGuidance:
				'Cursor picks up new skills live. MCP config is read at startup — use "Reload Window" in Cursor to pick up the new connection.',
		};
	},
};
