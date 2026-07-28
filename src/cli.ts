import { claudeCodeAdapter } from "./harnesses/claude-code";
import { codexAdapter } from "./harnesses/codex";
import { cursorAdapter } from "./harnesses/cursor";
import type { HarnessAdapter, HarnessId, HarnessInstallResult } from "./harnesses/types";
import type { Env } from "./lib/env";
import { getBundledSkillPath } from "./lib/skill-content";

export const ADAPTERS: readonly HarnessAdapter[] = [claudeCodeAdapter, cursorAdapter, codexAdapter];
const VALID_IDS: readonly HarnessId[] = ADAPTERS.map((adapter) => adapter.id);

export type Io = Readonly<{
	write(text: string): void;
	/** Returns the trimmed line the user typed. */
	prompt(question: string): Promise<string>;
}>;

export type CliOptions = Readonly<{
	yes: boolean;
	dryRun: boolean;
	help: boolean;
	version: boolean;
	/** `null` means "not specified" — fall back to auto-detection. */
	harnesses: readonly HarnessId[] | null;
}>;

export class CliUsageError extends Error {}

const USAGE = `Usage: tailwind-app-skills [options]

Installs the Tailwind MCP server and skill playbook into your coding agent.

Options:
  --yes                 Non-interactive: install into every detected harness
  --harness <name>       Install into a specific harness (claude-code, cursor, codex).
                         Repeatable, or comma-separated. Skips detection and the prompt.
  --dry-run              Print what would be written; change nothing
  --help                 Show this help
  --version              Show the installed version
`;

export function parseArgs(argv: readonly string[]): CliOptions {
	let yes = false;
	let dryRun = false;
	let help = false;
	let version = false;
	let harnesses: HarnessId[] | null = null;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		switch (arg) {
			case "--yes":
			case "-y":
				yes = true;
				break;
			case "--dry-run":
				dryRun = true;
				break;
			case "--help":
			case "-h":
				help = true;
				break;
			case "--version":
			case "-v":
				version = true;
				break;
			case "--harness": {
				index += 1;
				const value = argv[index];
				if (value === undefined) {
					throw new CliUsageError("--harness requires a value");
				}
				harnesses = [...(harnesses ?? []), ...parseHarnessList(value)];
				break;
			}
			default:
				throw new CliUsageError(`Unrecognized argument: ${arg}`);
		}
	}

	return { yes, dryRun, help, version, harnesses };
}

function parseHarnessList(value: string): HarnessId[] {
	return value.split(",").map((token) => {
		const trimmed = token.trim();
		if (!isHarnessId(trimmed)) {
			throw new CliUsageError(
				`Unknown harness "${trimmed}". Valid values: ${VALID_IDS.join(", ")}`,
			);
		}
		return trimmed;
	});
}

function isHarnessId(value: string): value is HarnessId {
	return (VALID_IDS as readonly string[]).includes(value);
}

function noHarnessDetectedMessage(): string {
	return [
		"No supported coding agent detected on this machine.",
		"",
		"Checked for:",
		"  Claude Code — `claude` on PATH, or ~/.claude",
		"  Cursor      — ~/.cursor",
		"  Codex       — `codex` on PATH, or ~/.codex",
		"",
		"Nothing was written. Install one of these tools, or pass --harness <name> to force a target.",
		"",
	].join("\n");
}

async function confirmSelection(
	candidates: readonly HarnessAdapter[],
	io: Io,
): Promise<readonly HarnessAdapter[]> {
	const labels = candidates.map((adapter) => adapter.label).join(", ");
	const answer = (await io.prompt(`Detected: ${labels}. Install into all of these? [Y/n] `))
		.trim()
		.toLowerCase();

	if (answer === "" || answer === "y" || answer === "yes") return candidates;
	if (answer === "n" || answer === "no") return [];

	const requested = new Set(
		answer
			.split(",")
			.map((token) => token.trim().toLowerCase())
			.filter((token) => token.length > 0),
	);
	return candidates.filter(
		(adapter) => requested.has(adapter.id) || requested.has(adapter.label.toLowerCase()),
	);
}

function formatReport(results: readonly HarnessInstallResult[], dryRun: boolean): string {
	const lines: string[] = [];
	if (dryRun) lines.push("Dry run — no files were written.", "");

	for (const result of results) {
		lines.push(`${result.label}:`);
		for (const step of result.steps) {
			const marker =
				step.status === "written"
					? "wrote"
					: step.status === "would-write"
						? "would write"
						: step.status === "skipped"
							? "skipped"
							: "FAILED";
			const target = step.path ? ` ${step.path}` : step.detail ? ` (${step.detail})` : "";
			lines.push(`  [${marker}] ${step.action}${target}`);
		}
	}

	if (!dryRun && results.some((result) => result.ok)) {
		lines.push("", "Restart needed:");
		for (const result of results) {
			if (result.ok) lines.push(`  ${result.label}: ${result.restartGuidance}`);
		}
	}

	return `${lines.join("\n")}\n`;
}

export async function run(
	env: Env,
	argv: readonly string[],
	io: Io,
	version: string,
): Promise<number> {
	let options: CliOptions;
	try {
		options = parseArgs(argv);
	} catch (error) {
		io.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
		return 1;
	}

	if (options.help) {
		io.write(USAGE);
		return 0;
	}

	if (options.version) {
		io.write(`${version}\n`);
		return 0;
	}

	const home = env.homedir();

	let candidates: readonly HarnessAdapter[];
	if (options.harnesses) {
		const requested = options.harnesses;
		candidates = ADAPTERS.filter((adapter) => requested.includes(adapter.id));
	} else {
		const detected: HarnessAdapter[] = [];
		for (const adapter of ADAPTERS) {
			if (await adapter.detect(env, home)) detected.push(adapter);
		}
		candidates = detected;
	}

	if (candidates.length === 0) {
		io.write(noHarnessDetectedMessage());
		return 0;
	}

	let selected = candidates;
	if (!options.yes && !options.dryRun && !options.harnesses) {
		selected = await confirmSelection(candidates, io);
	}

	if (selected.length === 0) {
		io.write("No harnesses selected. Nothing to do.\n");
		return 0;
	}

	const skillMarkdown = await env.readFile(getBundledSkillPath());
	if (skillMarkdown === undefined) {
		io.write("Could not read the bundled SKILL.md — installation aborted.\n");
		return 1;
	}

	const results: HarnessInstallResult[] = [];
	for (const adapter of selected) {
		results.push(await adapter.install(env, { home, skillMarkdown, dryRun: options.dryRun }));
	}

	io.write(formatReport(results, options.dryRun));

	return results.every((result) => result.ok) ? 0 : 1;
}
