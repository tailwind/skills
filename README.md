# @tailwind-app/skills

Connects your coding agent to [Tailwind](https://www.tailwindapp.com) and teaches it how to
schedule Pinterest Pins.

One command installs two things: the Tailwind MCP server config, and a skill playbook that
covers the parts of the API an agent gets wrong on its own.

```bash
npx @tailwind-app/skills
```

Supported harnesses: **Claude Code**, **Cursor**, and **Codex**.

## What it writes

The installer detects which harnesses you have, asks before touching anything, and prints
every path it wrote. Nothing else is modified.

| Harness | Skill playbook | MCP server config |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/tailwind-pinterest-scheduling/SKILL.md` | via `claude mcp add --scope user` |
| Cursor | `~/.cursor/skills/tailwind-pinterest-scheduling/SKILL.md` | merged into `~/.cursor/mcp.json` |
| Codex | `~/.agents/skills/tailwind-pinterest-scheduling/SKILL.md` | via `codex mcp add` |

For Claude Code and Codex the installer calls each tool's own CLI rather than editing config
files directly, so their merge semantics are theirs, not ours. Cursor has no equivalent
command, so its `mcp.json` is edited in place — reading the existing file, adding only the
`tailwind` key under `mcpServers`, and leaving every other server and top-level key untouched.
If that file contains invalid JSON, the installer reports it and stops rather than overwriting
something it could not parse.

After installing, restart your agent. Skill files are picked up live by Claude Code and Cursor,
but all three read MCP server config at startup, and Cursor needs a **Reload Window**.

## Claude plugin

This repository is also a Claude plugin. Claude Code users can install it through `/plugin`
instead of running the command above, and it uploads to claude.ai under
Settings > Customize > Plugins. Either way it provides the same two things — the same
`SKILL.md` and the same remote MCP server — so pick whichever you prefer; running both the
plugin and the installer is harmless but redundant.

The plugin is this repository root: [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json)
is the manifest and [`.mcp.json`](.mcp.json) is the server entry, which points at the same
`https://mcp.tailwind.ai` endpoint the installer configures. There is no bundled executable —
a plugin install adds a remote server and a Markdown file, nothing that runs locally.

## Options

```
--yes                 Non-interactive: install into every detected harness
--harness <name>      Install into a specific harness (claude-code, cursor, codex).
                      Repeatable, or comma-separated. Skips detection and the prompt.
--dry-run             Print what would be written; change nothing
--help                Show help
--version             Show the installed version
```

`--dry-run` is the honest way to see exactly what would land before it lands.

## Authentication

Connecting uses OAuth — your agent opens Tailwind in a browser and you approve access. No API
key is copied into a config file. If you'd rather use an API key, or your client can't do OAuth,
see the [setup documentation](https://api-docs.tailwind.ai/mcp/setup).

## No telemetry

This installer sends nothing anywhere. It has **no runtime dependencies**, and once running it
makes **no outbound requests of its own** — it reads and writes local files and shells out to
CLIs you already have. The playbook ships inside the published package, so nothing is fetched
from Tailwind's servers at any point, including on `--dry-run`.

To be precise about the one network step involved: `npx` downloads the package from npm the
first time, exactly as it would for any package. That is npm fetching the tarball, not the
installer calling home — and it is why a pinned version is fixed once you have it.

That's deliberate. This tool writes instructions your coding agent will follow, so it should be
something you can read in full and pin, not something that changes underneath you.

## Auditing and pinning

Every published version is immutable. To pin one:

```bash
npx @tailwind-app/skills@0.0.2
```

To read the playbook before installing anything, without running the installer at all:

```bash
npm view @tailwind-app/skills dist.tarball
```

Or browse the exact file that gets installed at
[unpkg.com/@tailwind-app/skills/skills/tailwind-pinterest-scheduling/SKILL.md](https://unpkg.com/@tailwind-app/skills/skills/tailwind-pinterest-scheduling/SKILL.md).

Releases are published from this repository's own CI with
[npm provenance](https://docs.npmjs.com/generating-provenance-statements), so each published
tarball is cryptographically linked to the commit and workflow that built it.

## Removing it

Delete the skill file for your harness from the table above, then remove the MCP server:

```bash
claude mcp remove tailwind --scope user   # Claude Code
codex mcp remove tailwind                 # Codex
```

For Cursor, delete the `tailwind` entry under `mcpServers` in `~/.cursor/mcp.json`.

## License

MIT
