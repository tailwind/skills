import path from "node:path";

import type { Env } from "./env";

/** True if `command` resolves to an executable file somewhere on PATH. */
export async function commandExists(env: Env, command: string): Promise<boolean> {
	for (const dir of env.pathDirs()) {
		for (const ext of env.pathExt()) {
			if (await env.isExecutableFile(path.join(dir, command + ext))) return true;
		}
	}
	return false;
}

export async function dirExists(env: Env, dirPath: string): Promise<boolean> {
	return env.fileExists(dirPath);
}
