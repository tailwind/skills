import { CODEX_MCP_ADD_ARGS } from "../generated/connect-facts";
import { CODEX_MIN_VERSION, isBelowMinimumVersion, parseCodexVersion } from "../lib/codex-version";
import { commandExists, dirExists } from "../lib/detect";
import type { Env } from "../lib/env";
import { describeExistingServer, isAlreadyExistsFailure } from "../lib/existing-server";
import { codexHomeDir, codexSkillPath } from "../lib/paths";
import type { HarnessAdapter, HarnessInstallResult, InstallOptions, StepResult } from "./types";
import { writeSkillFile } from "./write-skill-file";

/**
 * Warns (never hard-fails) when Codex is below the minimum version remote
 * MCP servers require. `codex --version` output isn't guaranteed stable
 * across releases, so an unparseable result is treated as "unknown" and
 * skipped silently rather than misreported as a warning or an error.
 */
async function checkVersion(env: Env): Promise<StepResult | undefined> {
	const result = await env.execFile("codex", ["--version"]);
	const version = parseCodexVersion(`${result.stdout}\n${result.stderr}`);
	if (version === null || !isBelowMinimumVersion(version)) return undefined;

	return {
		action: "version check",
		status: "skipped",
		detail: `codex ${version} detected; remote MCP servers need Codex ${CODEX_MIN_VERSION} or later`,
	};
}

async function addMcpServer(env: Env, dryRun: boolean): Promise<StepResult> {
	const commandPreview = `codex ${CODEX_MCP_ADD_ARGS.join(" ")}`;

	if (dryRun) {
		return { action: "mcp config", status: "would-write", detail: commandPreview };
	}

	const result = await env.execFile("codex", CODEX_MCP_ADD_ARGS);
	if (result.code === 0) {
		return { action: "mcp config", status: "written", detail: commandPreview };
	}

	if (isAlreadyExistsFailure(`${result.stdout}\n${result.stderr}`)) {
		return describeExistingServer(env, "codex", "tailwind", "codex mcp remove tailwind");
	}

	return {
		action: "mcp config",
		status: "failed",
		detail:
			result.stderr.trim() ||
			result.stdout.trim() ||
			`codex mcp add exited with code ${result.code}`,
	};
}

export const codexAdapter: HarnessAdapter = {
	id: "codex",
	label: "Codex",
	skillPath: codexSkillPath,
	async detect(env, home) {
		return (await commandExists(env, "codex")) || (await dirExists(env, codexHomeDir(home)));
	},
	async install(
		env: Env,
		{ home, skillMarkdown, dryRun }: InstallOptions,
	): Promise<HarnessInstallResult> {
		const steps: StepResult[] = [];

		if (!dryRun) {
			const versionWarning = await checkVersion(env);
			if (versionWarning) steps.push(versionWarning);
		}

		steps.push(await writeSkillFile(env, codexSkillPath(home), skillMarkdown, dryRun));
		steps.push(await addMcpServer(env, dryRun));

		return {
			id: "codex",
			label: "Codex",
			steps,
			ok: steps.every((step) => step.status !== "failed"),
			// `codex mcp add` only records the server. Without the login step the
			// install looks successful while Tailwind stays unauthenticated, so the
			// command has to be part of the closing instructions, not just the docs.
			restartGuidance:
				"Run `codex mcp login tailwind` to authenticate, then restart your Codex session — Codex reads its MCP config at startup.",
		};
	},
};
