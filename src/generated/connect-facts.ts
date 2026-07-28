// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by `packages/skills/scripts/generate-connect-facts.mjs` from `@tailwind-aero/core/mcp-connect-guidance`, the
// monorepo's single source of truth for the Tailwind MCP server URL.
//
// This file IS committed (unlike most generated build output in this repo):
// the published @tailwind-app/skills package must build standalone from a
// public mirror with no monorepo — and no @tailwind-aero/core — present.
//
// Regenerate:   pnpm --filter @tailwind-app/skills run codegen
// Verify fresh: pnpm --filter @tailwind-app/skills run codegen:check

export const MCP_SERVER_URL = "https://mcp.tailwind.ai";

/** Args passed to `claude` (excluding the binary itself) to add the Tailwind MCP server, user-scoped. */
export const CLAUDE_CODE_MCP_ADD_ARGS = [
	"mcp",
	"add",
	"--transport",
	"http",
	"--scope",
	"user",
	"tailwind",
	"https://mcp.tailwind.ai",
] as const;

/** Args passed to `codex` (excluding the binary itself) to add the Tailwind MCP server. */
export const CODEX_MCP_ADD_ARGS = [
	"mcp",
	"add",
	"tailwind",
	"--url",
	"https://mcp.tailwind.ai",
] as const;

/**
 * Value merged into `mcpServers.tailwind` in `~/.cursor/mcp.json`.
 * Bare `url`, deliberately with NO `type` discriminator — Cursor differs
 * from Claude Code (which requires `"type": "http"`) here.
 */
export const CURSOR_MCP_SERVER_CONFIG = {
	url: "https://mcp.tailwind.ai",
} as const;
