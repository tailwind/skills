import path from "node:path";

import type { Env } from "../lib/env";
import type { LoadedSkill } from "../lib/skills";
import type { StepResult } from "./types";

/** Shared by every harness adapter: write SKILL.md to its per-harness path. */
export async function writeSkillFile(
	env: Env,
	filePath: string,
	content: string,
	dryRun: boolean,
	detail?: string,
): Promise<StepResult> {
	if (dryRun) {
		return { action: "skill file", path: filePath, status: "would-write", detail };
	}

	await env.mkdir(path.dirname(filePath));
	await env.writeFile(filePath, content);
	return { action: "skill file", path: filePath, status: "written", detail };
}

/**
 * Write every playbook for one harness, one step per skill so the report names
 * each file it touched rather than collapsing them into a single line.
 *
 * A failure on one skill does not skip the rest: the same reason the CLI keeps
 * going after one harness fails — a user with an unwritable directory for one
 * playbook should still get the others.
 */
export async function writeSkillFiles(
	env: Env,
	skills: readonly LoadedSkill[],
	skillPath: (directoryName: string) => string,
	dryRun: boolean,
): Promise<StepResult[]> {
	const steps: StepResult[] = [];

	for (const skill of skills) {
		try {
			steps.push(
				await writeSkillFile(
					env,
					skillPath(skill.directoryName),
					skill.markdown,
					dryRun,
					skill.name,
				),
			);
		} catch (error) {
			steps.push({
				action: "skill file",
				path: skillPath(skill.directoryName),
				status: "failed",
				detail: `${skill.name}: ${error instanceof Error ? error.message : "the write failed"}`,
			});
		}
	}

	return steps;
}
