import path from "node:path";

import type { Env } from "./env";

export type SkillManifestEntry = Readonly<{
	/** Human-readable label for the install report. */
	name: string;
	/**
	 * Directory under `skills/` in this package, and the directory name written
	 * into each harness. One value, so what ships and what gets installed
	 * cannot drift apart.
	 */
	directoryName: string;
}>;

export type LoadedSkill = SkillManifestEntry & Readonly<{ markdown: string }>;

/**
 * Every playbook this package ships.
 *
 * This is the single source of truth: the installer writes exactly these, and
 * `skills.test.ts` asserts the `skills/` directory on disk contains exactly
 * these — so adding a directory without listing it here (or vice versa) fails
 * the build rather than silently shipping a playbook nobody installs.
 *
 * The Claude plugin needs no entry: a plugin reads every directory under
 * `<plugin root>/skills/` on its own.
 */
export const SKILL_MANIFEST: readonly SkillManifestEntry[] = [
	{ name: "Pinterest scheduling", directoryName: "tailwind-pinterest-scheduling" },
	{ name: "Pinterest profile audit", directoryName: "tailwind-pinterest-profile-audit" },
	{ name: "Pinterest board audit", directoryName: "tailwind-pinterest-board-audit" },
	{ name: "Pinterest draft review", directoryName: "tailwind-pinterest-draft-review" },
];

/**
 * Absolute path to a bundled SKILL.md, resolved relative to this module's own
 * location so it works both from src (tests, via vite-node's __dirname shim)
 * and from the compiled dist/lib output — both sit exactly two directories
 * below the package root.
 */
export function getBundledSkillPath(directoryName: string): string {
	return path.join(__dirname, "..", "..", "skills", directoryName, "SKILL.md");
}

export type LoadSkillsResult =
	| Readonly<{ ok: true; skills: readonly LoadedSkill[] }>
	| Readonly<{ ok: false; missing: readonly string[] }>;

/**
 * Read every manifested playbook off disk.
 *
 * All-or-nothing on purpose: a caller that installed the readable subset would
 * leave the user with a partial, silently incomplete install that looks
 * successful. Reporting which ones are missing lets the CLI stop before it
 * writes anything.
 */
export async function loadBundledSkills(
	env: Env,
	manifest: readonly SkillManifestEntry[] = SKILL_MANIFEST,
): Promise<LoadSkillsResult> {
	const skills: LoadedSkill[] = [];
	const missing: string[] = [];

	for (const entry of manifest) {
		const markdown = await env.readFile(getBundledSkillPath(entry.directoryName));

		if (markdown === undefined) {
			missing.push(entry.directoryName);
			continue;
		}

		skills.push({ ...entry, markdown });
	}

	return missing.length > 0 ? { ok: false, missing } : { ok: true, skills };
}
