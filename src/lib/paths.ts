import path from "node:path";

export const SKILL_NAME = "tailwind-pinterest-scheduling";

// User-scope destinations, per the three supported harnesses. Codex's skill
// directory is deliberately ~/.agents/skills, NOT ~/.codex/skills.
export function claudeCodeSkillPath(home: string): string {
	return path.join(home, ".claude", "skills", SKILL_NAME, "SKILL.md");
}

export function cursorSkillPath(home: string): string {
	return path.join(home, ".cursor", "skills", SKILL_NAME, "SKILL.md");
}

export function codexSkillPath(home: string): string {
	return path.join(home, ".agents", "skills", SKILL_NAME, "SKILL.md");
}

export function claudeCodeHomeDir(home: string): string {
	return path.join(home, ".claude");
}

export function cursorHomeDir(home: string): string {
	return path.join(home, ".cursor");
}

export function codexHomeDir(home: string): string {
	return path.join(home, ".codex");
}

export function cursorMcpConfigPath(home: string): string {
	return path.join(home, ".cursor", "mcp.json");
}
