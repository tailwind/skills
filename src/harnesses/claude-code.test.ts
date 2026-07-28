import { describe, expect, it } from "vitest";
import { MCP_SERVER_URL } from "../generated/connect-facts";
import { isAlreadyExistsFailure } from "../lib/existing-server";
import { createFakeEnv } from "../test-support/fake-env";
import { claudeCodeAdapter } from "./claude-code";

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

	// "already exists" has two causes with opposite meanings: an idempotent
	// re-run, and a server of the same name pointing somewhere else. Reporting
	// success for the second left the installer exiting 0 with restart guidance
	// while Tailwind was unreachable.
	it("reports success when the existing server already points at Tailwind", async () => {
		const { env } = createFakeEnv({
			execFile: (_command, args) =>
				args[0] === "mcp" && args[1] === "get"
					? { code: 0, stdout: `tailwind: ${MCP_SERVER_URL}`, stderr: "" }
					: { code: 1, stdout: "", stderr: 'server "tailwind" already exists' },
		});

		const result = await claudeCodeAdapter.install(env, {
			home: HOME,
			skillMarkdown: "# skill",
			dryRun: false,
		});

		const step = result.steps.find((entry) => entry.action === "mcp config");
		expect(step?.status).toBe("skipped");
		expect(result.ok).toBe(true);
	});

	it("fails, rather than claiming success, when a different server holds the tailwind name", async () => {
		const { env } = createFakeEnv({
			execFile: (_command, args) =>
				args[0] === "mcp" && args[1] === "get"
					? { code: 0, stdout: "tailwind: https://somewhere-else.example/mcp", stderr: "" }
					: { code: 1, stdout: "", stderr: 'server "tailwind" already exists' },
		});

		const result = await claudeCodeAdapter.install(env, {
			home: HOME,
			skillMarkdown: "# skill",
			dryRun: false,
		});

		const step = result.steps.find((entry) => entry.action === "mcp config");
		expect(step?.status).toBe("failed");
		expect(step?.detail).toContain("remove");
		expect(result.ok).toBe(false);
	});

	it("says so plainly when the existing entry cannot be read, instead of guessing", async () => {
		const { env } = createFakeEnv({
			execFile: (_command, args) =>
				args[0] === "mcp" && args[1] === "get"
					? { code: 1, stdout: "", stderr: "unknown command: get" }
					: { code: 1, stdout: "", stderr: 'server "tailwind" already exists' },
		});

		const result = await claudeCodeAdapter.install(env, {
			home: HOME,
			skillMarkdown: "# skill",
			dryRun: false,
		});

		const step = result.steps.find((entry) => entry.action === "mcp config");
		expect(step?.status).toBe("skipped");
		expect(step?.detail).toContain("could not be read");
	});
});
