import type { Env } from "../lib/env";
import type { LoadedSkill } from "../lib/skills";

export type HarnessId = "claude-code" | "cursor" | "codex" | "opencode";

export type StepStatus = "written" | "would-write" | "skipped" | "failed";

export type StepResult = Readonly<{
	/** Human label for what this step did, e.g. "skill file", "mcp config". */
	action: string;
	/** Full path touched (or that would be touched), when applicable. */
	path?: string;
	status: StepStatus;
	/** Extra context — a shell command preview, a skip/failure reason. */
	detail?: string;
}>;

export type HarnessInstallResult = Readonly<{
	id: HarnessId;
	label: string;
	steps: readonly StepResult[];
	/** False only when a step genuinely failed — "skipped" (idempotent no-op) still counts as ok. */
	ok: boolean;
	restartGuidance: string;
}>;

export type InstallOptions = Readonly<{
	home: string;
	/** Every playbook to install, already read off disk. */
	skills: readonly LoadedSkill[];
	dryRun: boolean;
}>;

export interface HarnessAdapter {
	readonly id: HarnessId;
	readonly label: string;
	skillPath(home: string, directoryName: string): string;
	detect(env: Env, home: string): Promise<boolean>;
	install(env: Env, options: InstallOptions): Promise<HarnessInstallResult>;
}
