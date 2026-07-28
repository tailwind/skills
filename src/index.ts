#!/usr/bin/env node
import { createInterface } from "node:readline/promises";

import { run } from "./cli";
import { createNodeEnv } from "./lib/node-env";

// package.json is always included in a published npm package regardless of
// the `files` allowlist, so this resolves both from src (ts-node/vitest) and
// from the compiled dist/index.js one directory down.
const packageJson = require("../package.json") as { version: string };

async function prompt(question: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return await rl.question(question);
	} finally {
		rl.close();
	}
}

const io = {
	write: (text: string) => {
		process.stdout.write(text);
	},
	prompt,
};

run(createNodeEnv(), process.argv.slice(2), io, packageJson.version)
	.then((exitCode) => {
		process.exitCode = exitCode;
	})
	.catch((error: unknown) => {
		process.stderr.write(
			`Unexpected error: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	});
