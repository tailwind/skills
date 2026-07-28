import { describe, expect, it } from "vitest";

import { MCP_SERVER_URL } from "../generated/connect-facts";
import { mergeCursorMcpConfig } from "./cursor-config";

describe("mergeCursorMcpConfig", () => {
	it("preserves every pre-existing MCP server and every unrelated top-level key — clobbering a user's other servers is the worst possible failure of this tool", () => {
		const existing = JSON.stringify({
			mcpServers: {
				github: { url: "https://github.example/mcp" },
				linear: { command: "npx", args: ["-y", "linear-mcp"] },
			},
			someUnrelatedCursorSetting: { nested: { value: 42 } },
		});

		const result = mergeCursorMcpConfig(existing);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected merge to succeed");

		const parsed = JSON.parse(result.content);
		expect(parsed.mcpServers.github).toEqual({ url: "https://github.example/mcp" });
		expect(parsed.mcpServers.linear).toEqual({ command: "npx", args: ["-y", "linear-mcp"] });
		expect(parsed.someUnrelatedCursorSetting).toEqual({ nested: { value: 42 } });
		expect(parsed.mcpServers.tailwind).toEqual({ url: MCP_SERVER_URL });
	});

	it("refuses to merge (ok: false) rather than guess when the existing file is malformed JSON", () => {
		const result = mergeCursorMcpConfig("{ this is not valid json");
		expect(result.ok).toBe(false);
	});

	it("refuses to merge when the existing file's top level is not a JSON object", () => {
		const result = mergeCursorMcpConfig("[1, 2, 3]");
		expect(result.ok).toBe(false);
	});

	it("creates a fresh config containing only the tailwind entry when no file exists", () => {
		const result = mergeCursorMcpConfig(undefined);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected merge to succeed");
		expect(JSON.parse(result.content)).toEqual({
			mcpServers: { tailwind: { url: MCP_SERVER_URL } },
		});
	});

	it("writes a bare `url`, with no `type` discriminator — unlike Claude Code, which requires type: http", () => {
		const result = mergeCursorMcpConfig(undefined);
		if (!result.ok) throw new Error("expected merge to succeed");
		const tailwindEntry = JSON.parse(result.content).mcpServers.tailwind;
		expect(tailwindEntry).not.toHaveProperty("type");
	});

	it("is idempotent: merging its own prior output produces byte-identical content", () => {
		const first = mergeCursorMcpConfig(undefined);
		if (!first.ok) throw new Error("expected merge to succeed");

		const second = mergeCursorMcpConfig(first.content);
		if (!second.ok) throw new Error("expected merge to succeed");

		expect(second.content).toBe(first.content);
	});

	it("writes 2-space indent with a trailing newline", () => {
		const result = mergeCursorMcpConfig(undefined);
		if (!result.ok) throw new Error("expected merge to succeed");
		expect(result.content.endsWith("\n")).toBe(true);
		expect(result.content).toContain('  "mcpServers"');
	});

	// A present-but-wrong-shaped mcpServers used to fall back to an empty object,
	// which read as a merge while silently discarding whatever was there. These
	// pin the refusal instead — the same treatment unparseable JSON gets.
	it.each([
		["an array", "[]"],
		["a string", '"nope"'],
		["null", "null"],
		["a number", "3"],
	])("refuses to write when mcpServers is %s, rather than replacing it", (_label, value) => {
		const result = mergeCursorMcpConfig(`{ "mcpServers": ${value} }`);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("mcpServers");
	});

	it("still creates mcpServers when the key is simply absent", () => {
		const result = mergeCursorMcpConfig('{ "someOtherSetting": true }');

		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.content);
			expect(parsed.someOtherSetting).toBe(true);
			expect(parsed.mcpServers.tailwind).toEqual({ url: MCP_SERVER_URL });
		}
	});
});
