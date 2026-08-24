import path from "node:path";

import type { Env } from "./env";

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

export function opencodeSkillPath(home: string, directoryName: string, env?: Env): string {
	return path.join(opencodeHomeDir(home, env), "skills", directoryName, "SKILL.md");
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

/**
 * OpenCode's global config directory. Matches its own resolution order,
 * verified against its vendored source (`packages/core/src/global.ts`, which
 * layers on the `xdg-basedir` package): an `OPENCODE_CONFIG_DIR` env var
 * names the directory outright, taking priority over `XDG_CONFIG_HOME` (which
 * is a base that `/opencode` is appended to, not the final directory itself);
 * with neither set it falls back to `~/.config/opencode`.
 *
 * `env` is optional only so this keeps satisfying `HarnessAdapter`'s shared,
 * env-less `skillPath(home, directoryName)` signature. Every real call site —
 * `install()`, `detect()` — has an `Env` and must pass it: a user with either
 * variable set has a config directory this installer would otherwise probe
 * and write to the wrong place, silently missing an existing `tailwind`
 * entry the conflict guard exists to catch.
 */
export function opencodeHomeDir(home: string, env?: Env): string {
	const override = env?.getEnv("OPENCODE_CONFIG_DIR");
	if (override) return override;

	// `||`, not `??`: xdg-basedir (which OpenCode's own resolution is built on)
	// falls back on an empty string too, not just an absent variable — an
	// exported-but-empty XDG_CONFIG_HOME is a real, valid shell state, and
	// treating it as "set" here would resolve to a bare "opencode" relative to
	// the process's cwd rather than the directory OpenCode itself would use.
	const xdgConfig = env?.getEnv("XDG_CONFIG_HOME") || path.join(home, ".config");
	return path.join(xdgConfig, "opencode");
}

/**
 * Candidate global config files, in the order OpenCode's own `resolveConfigPath`
 * checks them: the first that exists wins, and `opencode.json` is what it
 * creates when neither does.
 */
export function opencodeConfigCandidates(home: string, env?: Env): readonly string[] {
	const dir = opencodeHomeDir(home, env);
	return [path.join(dir, "opencode.json"), path.join(dir, "opencode.jsonc")];
}
