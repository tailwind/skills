import path from "node:path";

/**
 * Absolute path to the bundled SKILL.md, resolved relative to this module's
 * own location so it works both from src (tests, via vite-node's __dirname
 * shim) and from the compiled dist/lib output — both sit exactly two
 * directories below the package root.
 */
export function getBundledSkillPath(): string {
	return path.join(__dirname, "..", "..", "skills", SKILL_DIR_NAME, "SKILL.md");
}

const SKILL_DIR_NAME = "tailwind-pinterest-scheduling";
