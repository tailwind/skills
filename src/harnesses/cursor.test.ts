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

	// A plain writeFile truncates before it writes, so a failure partway through
	// would leave the user's other MCP servers destroyed. The merged content goes
	// to a sibling file and is renamed over the original only once it is written.
	it("writes through a temp sibling and renames, never truncating the real file", async () => {
		const { env, calls } = createFakeEnv({
			files: { [CONFIG_PATH]: '{"mcpServers":{"keep":{"url":"https://keep.example/mcp"}}}' },
		});

		await cursorAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });

		const configWrites = calls.writeFile.filter((write) => write.path === CONFIG_PATH);
		expect(configWrites).toHaveLength(0);
		expect(calls.rename).toContainEqual({
			from: `${CONFIG_PATH}.tailwind-install.tmp`,
			to: CONFIG_PATH,
		});
	});

	it("leaves the original untouched and cleans up when the temp write fails", async () => {
		const original = '{"mcpServers":{"keep":{"url":"https://keep.example/mcp"}}}';
		const tempPath = `${CONFIG_PATH}.tailwind-install.tmp`;
		const { env, calls, files } = createFakeEnv({
			files: { [CONFIG_PATH]: original },
			failWritesTo: [tempPath],
		});

		const result = await cursorAdapter.install(env, {
			home: HOME,
			skillMarkdown: "# skill",
			dryRun: false,
		});

		expect(files.get(CONFIG_PATH)).toBe(original);
		expect(calls.rename).toHaveLength(0);
		expect(calls.removeFile).toContain(tempPath);
		expect(result.ok).toBe(false);
	});

	// The atomic rename swaps in a new inode, so nothing about the original file
	// carries over unless it is copied deliberately. These pin the two things
	// that must survive it.
	it("keeps a restrictive mode, so a 0600 config holding tokens does not come back world-readable", async () => {
		const { env, calls, modes } = createFakeEnv({
			files: { [CONFIG_PATH]: '{"mcpServers":{}}' },
			modes: { [CONFIG_PATH]: 0o600 },
		});

		await cursorAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });

		// Asserted at creation, not after: a chmod that follows the write leaves a
		// window where the token-bearing file sits at the umask default, and a
		// crash in that window leaves it exposed for good.
		const tempWrite = calls.writeFile.find(
			(write) => write.path === `${CONFIG_PATH}.tailwind-install.tmp`,
		);
		expect(tempWrite?.mode).toBe(0o600);
		expect(modes.get(CONFIG_PATH)).toBe(0o600);
	});

	it("creates a brand-new config privately, since it can hold a bearer token", async () => {
		const { env, calls } = createFakeEnv();

		await cursorAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });

		const tempWrite = calls.writeFile.find((write) => write.path.endsWith(".tmp"));
		expect(tempWrite?.mode).toBe(0o600);
	});

	it("writes through a symlink whose target does not exist yet, rather than replacing the link", async () => {
		// realpath fails on a dangling link exactly as it does on a missing file.
		// Treating them the same would replace a dotfiles-managed link with a
		// regular file the first time it is installed into.
		const target = "/home/fake-user/dotfiles/cursor-mcp.json";
		const { env, calls } = createFakeEnv({ symlinks: { [CONFIG_PATH]: target } });

		await cursorAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });

		expect(calls.rename).toContainEqual({ from: `${target}.tailwind-install.tmp`, to: target });
		expect(calls.rename.some((call) => call.to === CONFIG_PATH)).toBe(false);
	});

	it("writes through a symlink to its target, leaving the link in place", async () => {
		const target = "/home/fake-user/dotfiles/cursor-mcp.json";
		const { env, calls, files } = createFakeEnv({
			files: { [target]: '{"mcpServers":{"keep":{"url":"https://keep.example/mcp"}}}' },
			symlinks: { [CONFIG_PATH]: target },
		});

		await cursorAdapter.install(env, { home: HOME, skillMarkdown: "# skill", dryRun: false });

		expect(calls.rename).toContainEqual({
			from: `${target}.tailwind-install.tmp`,
			to: target,
		});
		// The link itself is never written over, so dotfiles management survives.
		expect(calls.rename.some((call) => call.to === CONFIG_PATH)).toBe(false);
		const merged = JSON.parse(files.get(target) ?? "{}");
		expect(merged.mcpServers.keep).toBeDefined();
		expect(merged.mcpServers.tailwind).toBeDefined();
	});
});
