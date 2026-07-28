import { describe, expect, it } from "vitest";

import { createFakeEnv } from "../test-support/fake-env";
import { cursorAdapter } from "./cursor";

const HOME = "/home/fake-user";
const CONFIG_PATH = "/home/fake-user/.cursor/mcp.json";
const SKILL_PATH = "/home/fake-user/.cursor/skills/tailwind-pinterest-scheduling/SKILL.md";

describe("cursorAdapter", () => {
	it("writes the skill file to the Cursor-specific path", async () => {
		const { env, calls } = createFakeEnv();
		await cursorAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });
		expect(
			calls.writeFile.some((call) => call.path === SKILL_PATH && call.content === "# skill"),
		).toBe(true);
	});

	it("does NOT overwrite ~/.cursor/mcp.json when it contains malformed JSON — reports the problem and leaves the file untouched", async () => {
		const malformed = "{ not: valid json";
		const { env, calls, files } = createFakeEnv({ files: { [CONFIG_PATH]: malformed } });

		const result = await cursorAdapter.install(env, {
			home: HOME,
			skillMarkdown: "# skill",
			dryRun: false,
		});

		const mcpStep = result.steps.find((step) => step.action === "mcp config");
		expect(mcpStep?.status).toBe("failed");
		expect(result.ok).toBe(false);
		expect(calls.writeFile.some((call) => call.path === CONFIG_PATH)).toBe(false);
		expect(files.get(CONFIG_PATH)).toBe(malformed);
	});

	it("creates ~/.cursor/mcp.json correctly when it does not exist yet", async () => {
		const { env, files } = createFakeEnv();

		await cursorAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });

		const written = files.get(CONFIG_PATH);
		expect(written).toBeDefined();
		expect(JSON.parse(written as string)).toEqual({
			mcpServers: { tailwind: { url: expect.stringContaining("https://") } },
		});
	});

	it("re-running produces byte-identical mcp.json content the second time (idempotent)", async () => {
		const { env, files } = createFakeEnv();

		await cursorAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });
		const firstContent = files.get(CONFIG_PATH);

		await cursorAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });
		const secondContent = files.get(CONFIG_PATH);

		expect(secondContent).toBe(firstContent);
	});

	it("preserves an unrelated pre-existing server when installing end-to-end", async () => {
		const existing = JSON.stringify({
			mcpServers: { github: { url: "https://github.example/mcp" } },
		});
		const { env, files } = createFakeEnv({ files: { [CONFIG_PATH]: existing } });

		await cursorAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });

		const parsed = JSON.parse(files.get(CONFIG_PATH) as string);
		expect(parsed.mcpServers.github).toEqual({ url: "https://github.example/mcp" });
		expect(parsed.mcpServers.tailwind).toBeDefined();
	});
});
