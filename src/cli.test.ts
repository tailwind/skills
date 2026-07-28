import { describe, expect, it } from "vitest";
import { CliUsageError, parseArgs, run } from "./cli";
import { getBundledSkillPath } from "./lib/skill-content";
import { createFakeEnv } from "./test-support/fake-env";

const HOME = "/home/fake-user";
const BUNDLED_SKILL_FILES = { [getBundledSkillPath()]: "# skill" };

function makeIo() {
	const output: string[] = [];
	return {
		io: {
			write: (text: string) => {
				output.push(text);
			},
			prompt: async () => "",
		},
		output,
	};
}

describe("parseArgs", () => {
	it("merges repeated and comma-separated --harness values", () => {
		const options = parseArgs(["--harness", "claude-code", "--harness", "cursor,codex"]);
		expect(options.harnesses).toEqual(["claude-code", "cursor", "codex"]);
	});

	it("rejects an unknown harness name", () => {
		expect(() => parseArgs(["--harness", "nonexistent-tool"])).toThrow(CliUsageError);
	});

	it("rejects an unrecognized flag", () => {
		expect(() => parseArgs(["--bogus"])).toThrow(CliUsageError);
	});
});

describe("run — --dry-run", () => {
	it("writes nothing to disk and shells out to nothing, across every requested harness", async () => {
		const { env, calls } = createFakeEnv({ homedir: HOME, files: BUNDLED_SKILL_FILES });
		const { io } = makeIo();

		const exitCode = await run(
			env,
			["--dry-run", "--harness", "claude-code,cursor,codex"],
			io,
			"0.0.1-test",
		);

		expect(exitCode).toBe(0);
		expect(calls.writeFile).toHaveLength(0);
		expect(calls.mkdir).toHaveLength(0);
		expect(calls.execFile).toHaveLength(0);
	});
});

describe("run — idempotency", () => {
	it("running twice with --yes against the same forced harness produces identical file content", async () => {
		const { env, files } = createFakeEnv({ homedir: HOME, files: BUNDLED_SKILL_FILES });
		const { io } = makeIo();

		await run(env, ["--yes", "--harness", "cursor"], io, "0.0.1-test");
		const cursorConfigPath = `${HOME}/.cursor/mcp.json`;
		const skillPath = `${HOME}/.cursor/skills/tailwind-pinterest-scheduling/SKILL.md`;
		const firstConfig = files.get(cursorConfigPath);
		const firstSkill = files.get(skillPath);

		await run(env, ["--yes", "--harness", "cursor"], io, "0.0.1-test");
		const secondConfig = files.get(cursorConfigPath);
		const secondSkill = files.get(skillPath);

		expect(secondConfig).toBe(firstConfig);
		expect(secondSkill).toBe(firstSkill);
	});
});

describe("run — no harness detected", () => {
	it("exits cleanly (0) and writes nothing when nothing is detected and no --harness is forced", async () => {
		const { env, calls } = createFakeEnv({ homedir: HOME, pathDirs: [], existingPaths: [] });
		const { io, output } = makeIo();

		const exitCode = await run(env, [], io, "0.0.1-test");

		expect(exitCode).toBe(0);
		expect(calls.writeFile).toHaveLength(0);
		expect(output.join("")).toContain("No supported coding agent detected");
	});
});

describe("run — --help and --version", () => {
	it("prints usage for --help without touching the filesystem", async () => {
		const { env, calls } = createFakeEnv({ homedir: HOME });
		const { io, output } = makeIo();

		const exitCode = await run(env, ["--help"], io, "0.0.1-test");

		expect(exitCode).toBe(0);
		expect(output.join("")).toContain("Usage:");
		expect(calls.writeFile).toHaveLength(0);
	});

	it("prints the provided version string for --version", async () => {
		const { env } = createFakeEnv({ homedir: HOME });
		const { io, output } = makeIo();

		const exitCode = await run(env, ["--version"], io, "9.9.9");

		expect(exitCode).toBe(0);
		expect(output.join("")).toContain("9.9.9");
	});
});
