import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getBundledSkillPath } from "./lib/skill-content";

// These read the committed files rather than the generator's output on purpose.
// The marketplace pins to a commit in the public mirror and serves whatever is
// in the tree at that SHA — nothing regenerates these at install time, so what
// is committed is what users get.
const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath: string): unknown {
	return JSON.parse(readFileSync(path.join(packageRoot, relativePath), "utf8"));
}

const pluginManifest = readJson(".claude-plugin/plugin.json") as {
	name: string;
	version: string;
	description: string;
	homepage: string;
	repository: string;
	license: string;
};
const mcpConfig = readJson(".mcp.json") as {
	mcpServers: Record<string, { type?: string; url?: string; command?: string }>;
};
const packageManifest = readJson("package.json") as {
	version: string;
	homepage: string;
	repository: { url: string };
	license: string;
};

describe("Claude Code plugin MCP config", () => {
	// Claude Code reads a remote entry that carries only `url` as a stdio server
	// and then fails to spawn it. The failure looks like a broken server rather
	// than a malformed config, so it is slow to diagnose and easy to reintroduce
	// by copying Cursor's shape, which deliberately omits `type`.
	it("declares the remote server as http so Claude Code does not read it as stdio", () => {
		const server = mcpConfig.mcpServers.tailwind;

		expect(server).toBeDefined();
		expect(server?.type).toBe("http");
		expect(server?.command).toBeUndefined();
	});

	it("points at an https endpoint, never a local command", () => {
		const server = mcpConfig.mcpServers.tailwind;

		expect(server?.url).toMatch(/^https:\/\//);
	});

	// The root .gitignore blanket-ignores .mcp.json (developers' local MCP
	// config) and carries a `!packages/skills/.mcp.json` negation for this one.
	// That negation only works by its position in the file, with nothing else
	// guarding it — a later, unrelated .gitignore edit could silently re-ignore
	// this file, and `git add` would then drop it from every future commit with
	// no error. This asserts the file is actually tracked, not just present on
	// disk (a read from disk can't tell the two apart).
	it("is git-tracked, not silently re-ignored by the root .gitignore", () => {
		const tracked = execFileSync("git", ["ls-files", "--error-unmatch", ".mcp.json"], {
			cwd: packageRoot,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim();

		expect(tracked).toBe(".mcp.json");
	});

	// The npx installer registers the server under this same key. If the plugin
	// used a different one, a user who ran both would end up with two separately
	// named connections to the same server and two OAuth prompts.
	it("registers exactly one server, under the key the npx installer also uses", () => {
		expect(Object.keys(mcpConfig.mcpServers)).toEqual(["tailwind"]);
	});

	// The plugin name and the server key are two separately declared constants
	// in generate-plugin-files.mjs (one derived from the other, but still two
	// call sites); this catches them drifting apart directly, rather than each
	// independently matching the literal "tailwind" by coincidence.
	it("names the plugin after the same key it registers the server under", () => {
		expect(pluginManifest.name).toBe(Object.keys(mcpConfig.mcpServers)[0]);
	});
});

describe("Claude Code plugin manifest", () => {
	// A version bump on the npm package that leaves the plugin behind would ship
	// a marketplace listing reporting a version that never existed. codegen:check
	// enforces this at build time; this enforces it independently of whether that
	// script was run.
	it("reports the same version as the npm package it ships beside", () => {
		expect(pluginManifest.version).toBe(packageManifest.version);
	});

	it("names the plugin after the MCP server so /plugin and /mcp agree", () => {
		expect(pluginManifest.name).toBe("tailwind");
	});

	// homepage/repository/license are copied straight from package.json by
	// design (same repo backs both listings) rather than derived or checked
	// elsewhere — this is the only thing that would catch one of them going
	// stale if package.json changed without codegen being re-run.
	it("mirrors package.json's homepage, repository, and license", () => {
		expect(pluginManifest.homepage).toBe(packageManifest.homepage);
		expect(pluginManifest.repository).toBe(packageManifest.repository.url);
		expect(pluginManifest.license).toBe(packageManifest.license);
	});

	// The playbook is the reason this plugin exists — an MCP server alone is
	// already available through the npx installer and a plain `claude mcp add`.
	// The plugin discovers skills from <plugin root>/skills/, which is the same
	// directory the installer copies SKILL.md out of, so a rename that missed one
	// of the two would leave the plugin shipping a server and no guidance.
	it("ships the bundled skill inside the directory the plugin loads skills from", () => {
		const skillPath = getBundledSkillPath();

		expect(existsSync(skillPath)).toBe(true);
		expect(path.relative(packageRoot, skillPath).split(path.sep)[0]).toBe("skills");
	});
});
