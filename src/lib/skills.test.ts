import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFakeEnv } from "../test-support/fake-env";
import { getBundledSkillPath, loadBundledSkills, SKILL_MANIFEST } from "./skills";

const PACKAGE_ROOT = path.join(__dirname, "..", "..");

const TWO_SKILLS = [
	{ name: "First", directoryName: "tailwind-first" },
	{ name: "Second", directoryName: "tailwind-second" },
];

describe("SKILL_MANIFEST", () => {
	// The manifest drives the npx installer; the `skills/` directory drives the
	// Claude plugin, which discovers every directory under it on its own. Drift
	// between the two ships a playbook that installs one way and not the other,
	// which is invisible until a user reports the wrong thing being missing.
	it("lists exactly the playbook directories that ship on disk", () => {
		const onDisk = readdirSync(path.join(PACKAGE_ROOT, "skills"), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();

		const manifested = SKILL_MANIFEST.map((entry) => entry.directoryName).sort();

		expect(manifested).toEqual(onDisk);
	});

	it("gives every playbook a distinct directory so none can overwrite another", () => {
		const directoryNames = SKILL_MANIFEST.map((entry) => entry.directoryName);

		expect(new Set(directoryNames).size).toBe(directoryNames.length);
	});
});

describe("loadBundledSkills", () => {
	it("reads every manifested playbook", async () => {
		const { env } = createFakeEnv({
			files: {
				[getBundledSkillPath("tailwind-first")]: "# first",
				[getBundledSkillPath("tailwind-second")]: "# second",
			},
		});

		const result = await loadBundledSkills(env, TWO_SKILLS);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.skills.map((skill) => skill.markdown)).toEqual(["# first", "# second"]);
		expect(result.skills[0]?.name).toBe("First");
	});

	it("fails with the missing directory rather than returning the readable subset", async () => {
		// A partial load would install some playbooks and silently skip others
		// while still reporting success.
		const { env } = createFakeEnv({
			files: { [getBundledSkillPath("tailwind-first")]: "# first" },
		});

		const result = await loadBundledSkills(env, TWO_SKILLS);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.missing).toEqual(["tailwind-second"]);
	});
});
