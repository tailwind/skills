import path from "node:path";

import { mergeCursorMcpConfig } from "../lib/cursor-config";
import { dirExists } from "../lib/detect";
import type { Env } from "../lib/env";
import { cursorHomeDir, cursorMcpConfigPath, cursorSkillPath } from "../lib/paths";
import type { HarnessAdapter, HarnessInstallResult, InstallOptions, StepResult } from "./types";
import { writeSkillFile } from "./write-skill-file";

async function writeMcpConfig(env: Env, home: string, dryRun: boolean): Promise<StepResult> {
	const configPath = cursorMcpConfigPath(home);

	// Resolve up front so the read and the write address the same file. When the
	// config is a symlink into a dotfiles repo, renaming over the link would
	// replace it with a regular file and silently detach it from the repo that
	// manages it; following it first means the managed file is what changes.
	const targetPath = await env.realpath(configPath);

	const existingRaw = await env.readFile(targetPath);
	const merge = mergeCursorMcpConfig(existingRaw);

	if (!merge.ok) {
		return {
			action: "mcp config",
			path: configPath,
			status: "failed",
			// The path is reported separately by the formatter; repeating it here
			// would print it twice.
			detail: `${merge.reason}; left untouched. Fix or remove the file, then re-run.`,
		};
	}

	if (dryRun) {
		return { action: "mcp config", path: configPath, status: "would-write" };
	}

	// The target may live elsewhere than the link, so create its directory, not
	// the link's.
	await env.mkdir(path.dirname(targetPath));

	// The rename swaps in a new inode, so the original's permissions do not
	// carry over. Read them first and create the temp file with them, rather
	// than chmod-ing afterwards: this config can hold a bearer token, and a file
	// that briefly exists at the umask default — or outlives a crash before the
	// chmod — is exposed for that whole window. A file we are creating fresh
	// starts private for the same reason.
	const mode = (await env.fileMode(targetPath)) ?? 0o600;

	// Write to a sibling and rename over the target. A plain writeFile truncates
	// first, so an interrupted or failing write would leave the user's other MCP
	// servers destroyed — the exact loss the merge above avoids. The temp file
	// sits beside the target so the rename is atomic.
	const tempPath = `${targetPath}.tailwind-install.tmp`;
	try {
		await env.writeFile(tempPath, merge.content, { mode });
		await env.rename(tempPath, targetPath);
	} catch (error) {
		// Clean up the partial temp file and report, rather than throwing — a
		// failed config write is the same class of outcome as a config we refused
		// to parse, and the user should see it in the report either way.
		await env.removeFile(tempPath);
		return {
			action: "mcp config",
			path: configPath,
			status: "failed",
			detail: `${error instanceof Error ? error.message : "the write failed"}; left untouched.`,
		};
	}

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
