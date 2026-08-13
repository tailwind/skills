import { describe, expect, it } from "vitest";
import { createFakeEnv } from "../test-support/fake-env";
import { claudeCodeAdapter } from "./claude-code";
import { codexAdapter } from "./codex";
import { cursorAdapter } from "./cursor";
import type { HarnessAdapter } from "./types";

const HOME = "/home/fake-user";

/**
 * Three playbooks, matching the shape this package ships once the audit
 * skills land. The adapters are exercised with more than one deliberately —
 * the installer was hardwired to a single playbook, and every path that
 * silently kept installing only the first would pass a one-skill fixture.
 */
const SKILLS = [
	{
		name: "Pinterest scheduling",
		directoryName: "tailwind-pinterest-scheduling",
		markdown: "# scheduling",
	},
	{
		name: "Pinterest profile audit",
		directoryName: "tailwind-pinterest-profile-audit",
		markdown: "# profile",
	},
	{
		name: "Pinterest board audit",
		directoryName: "tailwind-pinterest-board-audit",
		markdown: "# boards",
	},
];

const ADAPTERS: Array<{ adapter: HarnessAdapter; skillsRoot: string }> = [
	{ adapter: claudeCodeAdapter, skillsRoot: `${HOME}/.claude/skills` },
	{ adapter: cursorAdapter, skillsRoot: `${HOME}/.cursor/skills` },
	{ adapter: codexAdapter, skillsRoot: `${HOME}/.agents/skills` },
];

describe.each(ADAPTERS)("$adapter.label installs every playbook", ({ adapter, skillsRoot }) => {
	it("writes one SKILL.md per playbook, each in its own directory", async () => {
		const { env, calls } = createFakeEnv();

		await adapter.install(env, { home: HOME, skills: SKILLS, dryRun: false });

		for (const skill of SKILLS) {
			const expectedPath = `${skillsRoot}/${skill.directoryName}/SKILL.md`;
			const written = calls.writeFile.find((call) => call.path === expectedPath);

			expect(written, `${adapter.label} did not write ${expectedPath}`).toBeDefined();
			expect(written?.content).toBe(skill.markdown);
		}
	});

	it("reports a step per playbook so the user sees each file it touched", async () => {
		const { env } = createFakeEnv();

		const result = await adapter.install(env, { home: HOME, skills: SKILLS, dryRun: false });

		const skillSteps = result.steps.filter((step) => step.action === "skill file");
		expect(skillSteps).toHaveLength(SKILLS.length);
		expect(skillSteps.map((step) => step.detail)).toEqual(SKILLS.map((skill) => skill.name));
	});

	it("writes nothing but still reports every playbook on a dry run", async () => {
		const { env, calls } = createFakeEnv();

		const result = await adapter.install(env, { home: HOME, skills: SKILLS, dryRun: true });

		expect(calls.writeFile).toHaveLength(0);
		expect(result.steps.filter((step) => step.action === "skill file")).toHaveLength(SKILLS.length);
	});

	it("keeps installing the remaining playbooks when one file cannot be written", async () => {
		// One unwritable directory should cost the user that playbook, not the
		// other two — the same isolation the CLI already applies per harness.
		const failingPath = `${skillsRoot}/${SKILLS[1]?.directoryName}/SKILL.md`;
		const { env, calls } = createFakeEnv({ failWritesTo: [failingPath] });

		const result = await adapter.install(env, { home: HOME, skills: SKILLS, dryRun: false });

		const written = calls.writeFile.map((call) => call.path);
		expect(written).toContain(`${skillsRoot}/${SKILLS[0]?.directoryName}/SKILL.md`);
		expect(written).toContain(`${skillsRoot}/${SKILLS[2]?.directoryName}/SKILL.md`);

		const failed = result.steps.filter((step) => step.status === "failed");
		expect(failed).toHaveLength(1);
		expect(failed[0]?.path).toBe(failingPath);
		expect(result.ok).toBe(false);
	});
});
