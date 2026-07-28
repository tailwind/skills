import { describe, expect, it } from "vitest";

import { createFakeEnv } from "../test-support/fake-env";
import { claudeCodeAdapter, isAlreadyExistsFailure } from "./claude-code";

const HOME = "/home/fake-user";
const SKILL_PATH = "/home/fake-user/.claude/skills/tailwind-pinterest-scheduling/SKILL.md";

describe("claudeCodeAdapter", () => {
	it("writes the skill file to the Claude Code-specific path", async () => {
		const { env, calls } = createFakeEnv();
		await claudeCodeAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });
		expect(
			calls.writeFile.some((call) => call.path === SKILL_PATH && call.content === "# skill"),
		).toBe(true);
	});

	it("treats a `claude mcp add` failure whose output mentions an existing server as SUCCESS — this is what a correct, idempotent re-run looks like, not an error", async () => {
		const { env } = createFakeEnv({
			execFile: () => ({
				code: 1,
				stdout: "",
				stderr: "Error: A server with the name tailwind already exists in user config",
			}),
		});

		const result = await claudeCodeAdapter.install(env, {
			home: HOME,
			skillMarkdown: "# skill",
			dryRun: false,
		});

		const mcpStep = result.steps.find((step) => step.action === "mcp config");
		expect(mcpStep?.status).toBe("skipped");
		expect(result.ok).toBe(true);
	});

	it("treats a genuine `claude mcp add` failure (unrelated to a duplicate name) as a real failure", async () => {
		const { env } = createFakeEnv({
			execFile: () => ({ code: 1, stdout: "", stderr: "command not found: claude" }),
		});

		const result = await claudeCodeAdapter.install(env, {
			home: HOME,
			skillMarkdown: "# skill",
			dryRun: false,
		});

		const mcpStep = result.steps.find((step) => step.action === "mcp config");
		expect(mcpStep?.status).toBe("failed");
		expect(result.ok).toBe(false);
	});

	it("isAlreadyExistsFailure matches case-insensitively and ignores unrelated errors", () => {
		expect(isAlreadyExistsFailure('MCP server "tailwind" ALREADY EXISTS')).toBe(true);
		expect(isAlreadyExistsFailure("permission denied")).toBe(false);
	});
});
