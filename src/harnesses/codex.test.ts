import { describe, expect, it } from "vitest";

import { createFakeEnv } from "../test-support/fake-env";
import { codexAdapter } from "./codex";

const HOME = "/home/fake-user";
// Deliberately ~/.agents/skills, NOT ~/.codex/skills.
const SKILL_PATH = "/home/fake-user/.agents/skills/tailwind-pinterest-scheduling/SKILL.md";

describe("codexAdapter", () => {
	it("writes the skill file to ~/.agents/skills, not ~/.codex/skills", async () => {
		const { env, calls } = createFakeEnv({
			execFile: (command) =>
				command === "codex"
					? { code: 0, stdout: "codex-cli 0.80.0", stderr: "" }
					: { code: 0, stdout: "", stderr: "" },
		});

		await codexAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });

		expect(calls.writeFile.some((call) => call.path === SKILL_PATH)).toBe(true);
	});

	it("warns (but does not fail) when the installed Codex CLI is below the minimum version for remote MCP servers", async () => {
		const { env } = createFakeEnv({
			execFile: (command, args) => {
				if (command === "codex" && args[0] === "--version") {
					return { code: 0, stdout: "codex-cli 0.50.0", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		});

		const result = await codexAdapter.install(env, {
			home: HOME,
			skillMarkdown: "# skill",
			dryRun: false,
		});

		const versionStep = result.steps.find((step) => step.action === "version check");
		expect(versionStep?.status).toBe("skipped");
		expect(result.ok).toBe(true);
	});

	it("proceeds silently (no version-check step) when `codex --version` output does not parse as a version", async () => {
		const { env } = createFakeEnv({
			execFile: (command, args) => {
				if (command === "codex" && args[0] === "--version") {
					return { code: 0, stdout: "unexpected format with no numbers", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		});

		const result = await codexAdapter.install(env, {
			home: HOME,
			skillMarkdown: "# skill",
			dryRun: false,
		});

		expect(result.steps.some((step) => step.action === "version check")).toBe(false);
		expect(result.ok).toBe(true);
	});

	it("does not shell out at all in dry-run mode", async () => {
		const { env, calls } = createFakeEnv();
		await codexAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: true });
		expect(calls.execFile).toHaveLength(0);
	});

	// `codex mcp add` records the server but does not authenticate. Without this
	// instruction the install reports success while Tailwind stays unusable, so
	// the login command has to survive in the closing guidance.
	it("tells the user to complete the OAuth login, not just to restart", async () => {
		const { env } = createFakeEnv({
			execFile: async () => ({ code: 0, stdout: "", stderr: "" }),
		});

		const result = await codexAdapter.install(env, {
			home: HOME,
			skillMarkdown: "# skill",
			dryRun: false,
		});

		expect(result.restartGuidance).toContain("codex mcp login tailwind");
	});
});
