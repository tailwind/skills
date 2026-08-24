import { describe, expect, it } from "vitest";

import { createFakeEnv } from "../test-support/fake-env";
import { opencodeAdapter } from "./opencode";

const SKILLS = [
	{
		name: "Pinterest scheduling",
		directoryName: "tailwind-pinterest-scheduling",
		markdown: "# skill",
	},
];

const HOME = "/home/fake-user";
const CONFIG_PATH = `${HOME}/.config/opencode/opencode.json`;
const SKILL_PATH = `${HOME}/.config/opencode/skills/tailwind-pinterest-scheduling/SKILL.md`;
const SERVER_URL = "https://mcp.tailwind.ai";

const install = (env: Parameters<typeof opencodeAdapter.install>[0], dryRun = false) =>
	opencodeAdapter.install(env, { home: HOME, skills: SKILLS, dryRun });

const mcpStep = (result: Awaited<ReturnType<typeof opencodeAdapter.install>>) =>
	result.steps.find((step) => step.action === "mcp config");

describe("opencodeAdapter", () => {
	it("writes the skill file to OpenCode's own skills directory, so --harness opencode alone is a complete install", async () => {
		const { env, calls } = createFakeEnv();
		await install(env);
		expect(
			calls.writeFile.some((call) => call.path === SKILL_PATH && call.content === "# skill"),
		).toBe(true);
	});

	it("adds the server through opencode's own CLI rather than editing the config file", async () => {
		const { env, calls } = createFakeEnv();
		const result = await install(env);

		expect(calls.execFile).toContainEqual({
			command: "opencode",
			args: ["mcp", "add", "tailwind", "--url", SERVER_URL],
		});
		expect(calls.writeFile.some((call) => call.path === CONFIG_PATH)).toBe(false);
		expect(mcpStep(result)?.status).toBe("written");
		expect(result.ok).toBe(true);
	});

	it("does NOT re-add a tailwind server that already points at us — re-adding would drop keys the user set on it", async () => {
		const { env, calls } = createFakeEnv({
			files: {
				[CONFIG_PATH]: JSON.stringify({
					mcp: { tailwind: { type: "remote", url: SERVER_URL, enabled: false } },
				}),
			},
		});

		const result = await install(env);

		expect(calls.execFile).toEqual([]);
		expect(mcpStep(result)?.status).toBe("skipped");
		expect(result.ok).toBe(true);
	});

	it("does NOT overwrite a different MCP server that already holds the tailwind name", async () => {
		const { env, calls } = createFakeEnv({
			files: {
				[CONFIG_PATH]: JSON.stringify({
					mcp: { tailwind: { type: "remote", url: "https://someone-else.test" } },
				}),
			},
		});

		const result = await install(env);

		// `opencode mcp add` would have rewritten the entry without complaint.
		expect(calls.execFile).toEqual([]);
		expect(mcpStep(result)?.status).toBe("failed");
		expect(mcpStep(result)?.detail).toContain("https://someone-else.test");
		expect(result.ok).toBe(false);
	});

	it("refuses to add when the config cannot be parsed, since an existing server cannot be ruled out", async () => {
		const { env, calls } = createFakeEnv({ files: { [CONFIG_PATH]: "{ not valid" } });

		const result = await install(env);

		expect(calls.execFile).toEqual([]);
		expect(mcpStep(result)?.status).toBe("failed");
		expect(mcpStep(result)?.detail).toContain("opencode mcp add tailwind --url");
		expect(result.ok).toBe(false);
	});

	it("reports a failed opencode mcp add rather than claiming success", async () => {
		const { env } = createFakeEnv({
			execFile: () => ({ code: 1, stdout: "", stderr: "opencode: command failed" }),
		});

		const result = await install(env);

		expect(mcpStep(result)?.status).toBe("failed");
		expect(mcpStep(result)?.detail).toBe("opencode: command failed");
		expect(result.ok).toBe(false);
	});

	it("changes nothing on a dry run", async () => {
		const { env, calls } = createFakeEnv();
		const result = await install(env, true);

		expect(calls.writeFile).toEqual([]);
		expect(calls.execFile).toEqual([]);
		expect(mcpStep(result)?.status).toBe("would-write");
	});

	it("detects OpenCode from the binary on PATH or its config directory", async () => {
		const viaBinary = createFakeEnv({
			pathDirs: ["/usr/local/bin"],
			executables: ["/usr/local/bin/opencode"],
		});
		const viaConfigDir = createFakeEnv({
			existingPaths: [`${HOME}/.config/opencode`],
		});
		const neither = createFakeEnv();

		await expect(opencodeAdapter.detect(viaBinary.env, HOME)).resolves.toBe(true);
		await expect(opencodeAdapter.detect(viaConfigDir.env, HOME)).resolves.toBe(true);
		await expect(opencodeAdapter.detect(neither.env, HOME)).resolves.toBe(false);
	});

	it("detects a config directory under $XDG_CONFIG_HOME rather than ~/.config, matching where OpenCode itself looks", async () => {
		const { env } = createFakeEnv({
			env: { XDG_CONFIG_HOME: "/mnt/xdg-config" },
			existingPaths: ["/mnt/xdg-config/opencode"],
		});
		await expect(opencodeAdapter.detect(env, HOME)).resolves.toBe(true);
	});

	it("writes skill files under $XDG_CONFIG_HOME when it's set, not the default ~/.config path", async () => {
		const { env, calls } = createFakeEnv({ env: { XDG_CONFIG_HOME: "/mnt/xdg-config" } });
		await install(env);

		const xdgSkillPath = "/mnt/xdg-config/opencode/skills/tailwind-pinterest-scheduling/SKILL.md";
		expect(calls.writeFile.some((call) => call.path === xdgSkillPath)).toBe(true);
		expect(calls.writeFile.some((call) => call.path === SKILL_PATH)).toBe(false);
	});

	it("falls back to ~/.config when $XDG_CONFIG_HOME is exported empty, not a cwd-relative 'opencode' path", async () => {
		const { env, calls } = createFakeEnv({ env: { XDG_CONFIG_HOME: "" } });
		await install(env);

		expect(calls.writeFile.some((call) => call.path === SKILL_PATH)).toBe(true);
		expect(calls.writeFile.some((call) => call.path.startsWith("opencode/"))).toBe(false);
	});
});
