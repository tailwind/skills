import path from "node:path";

// User-scope destinations, per the three supported harnesses. Each takes the
// skill's directory name rather than closing over a single constant, so the
// package can ship more than one playbook. Codex's skill directory is
// deliberately ~/.agents/skills, NOT ~/.codex/skills.
export function claudeCodeSkillPath(home: string, directoryName: string): string {
	return path.join(home, ".claude", "skills", directoryName, "SKILL.md");
}

export function cursorSkillPath(home: string, directoryName: string): string {
	return path.join(home, ".cursor", "skills", directoryName, "SKILL.md");
}

export function codexSkillPath(home: string, directoryName: string): string {
	return path.join(home, ".agents", "skills", directoryName, "SKILL.md");
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
