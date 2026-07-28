import path from "node:path";

import type { Env } from "../lib/env";
import type { StepResult } from "./types";

/** Shared by all three harness adapters: write SKILL.md to its per-harness path. */
export async function writeSkillFile(
	env: Env,
	filePath: string,
	content: string,
	dryRun: boolean,
): Promise<StepResult> {
	if (dryRun) {
		return { action: "skill file", path: filePath, status: "would-write" };
	}

	await env.mkdir(path.dirname(filePath));
	await env.writeFile(filePath, content);
	return { action: "skill file", path: filePath, status: "written" };
}
