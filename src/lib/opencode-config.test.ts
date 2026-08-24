import { describe, expect, it } from "vitest";

import { createFakeEnv } from "../test-support/fake-env";
import { inspectOpencodeConfig, stripJsonComments } from "./opencode-config";

const HOME = "/home/fake-user";
const JSON_PATH = `${HOME}/.config/opencode/opencode.json`;
const JSONC_PATH = `${HOME}/.config/opencode/opencode.jsonc`;
const SERVER_URL = "https://mcp.tailwind.ai";

describe("stripJsonComments", () => {
	it("leaves a // sequence inside a string alone — a server URL is not a comment", () => {
		const source = `{"url":"https://mcp.tailwind.ai"}`;
		expect(JSON.parse(stripJsonComments(source))).toEqual({ url: SERVER_URL });
	});

	it("keeps an escaped quote from ending the string early", () => {
		const source = `{"note":"say \\"hi\\" // not a comment","keep":1}`;
		expect(JSON.parse(stripJsonComments(source))).toEqual({
			note: 'say "hi" // not a comment',
			keep: 1,
		});
	});

	it("removes line and block comments so a JSONC config parses", () => {
		const source = `{
			// which server
			"mcp": { /* inline */ "tailwind": { "url": "${SERVER_URL}" } }
		}`;
		expect(JSON.parse(stripJsonComments(source))).toEqual({
			mcp: { tailwind: { url: SERVER_URL } },
		});
	});
});

describe("inspectOpencodeConfig", () => {
	it("reports absent when no config file exists, so a first install can proceed", async () => {
		const { env } = createFakeEnv();
		await expect(inspectOpencodeConfig(env, HOME)).resolves.toEqual({ kind: "absent" });
	});

	it("reports absent when the config exists but configures no tailwind server", async () => {
		const { env } = createFakeEnv({
			files: { [JSON_PATH]: JSON.stringify({ mcp: { other: { url: "https://example.test" } } }) },
		});
		await expect(inspectOpencodeConfig(env, HOME)).resolves.toEqual({ kind: "absent" });
	});

	it("reports matches when tailwind already points at our server, so it is left as-is", async () => {
		const { env } = createFakeEnv({
			files: {
				[JSON_PATH]: JSON.stringify({
					mcp: { tailwind: { type: "remote", url: SERVER_URL, enabled: false } },
				}),
			},
		});
		await expect(inspectOpencodeConfig(env, HOME)).resolves.toEqual({
			kind: "matches",
			path: JSON_PATH,
		});
	});

	it("reports a conflict when a different server owns the tailwind name", async () => {
		const { env } = createFakeEnv({
			files: {
				[JSON_PATH]: JSON.stringify({
					mcp: { tailwind: { type: "remote", url: "https://someone-else.test" } },
				}),
			},
		});
		await expect(inspectOpencodeConfig(env, HOME)).resolves.toEqual({
			kind: "conflict",
			path: JSON_PATH,
			url: "https://someone-else.test",
		});
	});

	it("reads a commented .jsonc config rather than giving up on it", async () => {
		const { env } = createFakeEnv({
			files: {
				[JSONC_PATH]: `{
					// my servers
					"mcp": { "tailwind": { "type": "remote", "url": "${SERVER_URL}" } }
				}`,
			},
		});
		await expect(inspectOpencodeConfig(env, HOME)).resolves.toEqual({
			kind: "matches",
			path: JSONC_PATH,
		});
	});

	it("prefers opencode.json over opencode.jsonc, matching OpenCode's own candidate order", async () => {
		const { env } = createFakeEnv({
			files: {
				[JSON_PATH]: JSON.stringify({ mcp: { tailwind: { url: SERVER_URL } } }),
				[JSONC_PATH]: JSON.stringify({ mcp: { tailwind: { url: "https://stale.test" } } }),
			},
		});
		await expect(inspectOpencodeConfig(env, HOME)).resolves.toEqual({
			kind: "matches",
			path: JSON_PATH,
		});
	});

	it("reports unreadable rather than absent when the config cannot be parsed — an existing server cannot be ruled out", async () => {
		const { env } = createFakeEnv({ files: { [JSON_PATH]: "{ mcp: not json" } });
		const result = await inspectOpencodeConfig(env, HOME);
		expect(result.kind).toBe("unreadable");
	});

	it("treats a tailwind entry with no url as a conflict, not a match", async () => {
		const { env } = createFakeEnv({
			files: { [JSON_PATH]: JSON.stringify({ mcp: { tailwind: { type: "local", command: [] } } }) },
		});
		await expect(inspectOpencodeConfig(env, HOME)).resolves.toEqual({
			kind: "conflict",
			path: JSON_PATH,
			url: undefined,
		});
	});

	it("reads from $XDG_CONFIG_HOME/opencode rather than ~/.config/opencode when the variable is set", async () => {
		const xdgPath = "/mnt/xdg-config/opencode/opencode.json";
		const { env } = createFakeEnv({
			env: { XDG_CONFIG_HOME: "/mnt/xdg-config" },
			files: {
				// A conflicting entry at the default path must NOT be what gets
				// read — OpenCode itself never looks there once XDG_CONFIG_HOME is set.
				[JSON_PATH]: JSON.stringify({ mcp: { tailwind: { url: "https://ignored.test" } } }),
				[xdgPath]: JSON.stringify({ mcp: { tailwind: { url: "https://someone-else.test" } } }),
			},
		});
		await expect(inspectOpencodeConfig(env, HOME)).resolves.toEqual({
			kind: "conflict",
			path: xdgPath,
			url: "https://someone-else.test",
		});
	});

	it("reads from $OPENCODE_CONFIG_DIR directly (no /opencode suffix) when set, taking priority over $XDG_CONFIG_HOME", async () => {
		const explicitPath = "/etc/opencode-managed/opencode.json";
		const { env } = createFakeEnv({
			env: {
				OPENCODE_CONFIG_DIR: "/etc/opencode-managed",
				XDG_CONFIG_HOME: "/mnt/xdg-config",
			},
			files: { [explicitPath]: JSON.stringify({ mcp: { tailwind: { url: SERVER_URL } } }) },
		});
		await expect(inspectOpencodeConfig(env, HOME)).resolves.toEqual({
			kind: "matches",
			path: explicitPath,
		});
	});

	it("treats an exported-but-empty $XDG_CONFIG_HOME as unset, matching xdg-basedir's own fallback", async () => {
		const { env } = createFakeEnv({
			env: { XDG_CONFIG_HOME: "" },
			files: { [JSON_PATH]: JSON.stringify({ mcp: { tailwind: { url: SERVER_URL } } }) },
		});
		await expect(inspectOpencodeConfig(env, HOME)).resolves.toEqual({
			kind: "matches",
			path: JSON_PATH,
		});
	});
});
