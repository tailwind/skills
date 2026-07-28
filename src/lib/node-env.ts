import { execFile as execFileCb } from "node:child_process";
import {
	access,
	constants,
	mkdir as fsMkdir,
	readFile as fsReadFile,
	writeFile as fsWriteFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter } from "node:path";
import { promisify } from "node:util";

import type { Env, ExecResult } from "./env";

const execFileAsync = promisify(execFileCb);

function isEnoent(error: unknown): boolean {
	return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

/** The real, disk-and-process-touching implementation of {@link Env}. Used only by the CLI entrypoint. */
export function createNodeEnv(): Env {
	return {
		platform: process.platform,
		homedir,
		pathDirs() {
			return (process.env.PATH ?? "").split(delimiter).filter((entry) => entry.length > 0);
		},
		pathExt() {
			if (process.platform !== "win32") return [""];
			return (process.env.PATHEXT ?? ".EXE;.CMD;.BAT")
				.split(";")
				.filter((entry) => entry.length > 0);
		},
		async fileExists(path) {
			try {
				await access(path, constants.F_OK);
				return true;
			} catch {
				return false;
			}
		},
		async isExecutableFile(path) {
			try {
				await access(path, constants.X_OK);
				return true;
			} catch {
				return false;
			}
		},
		async readFile(path) {
			try {
				return await fsReadFile(path, "utf8");
			} catch (error) {
				if (isEnoent(error)) return undefined;
				throw error;
			}
		},
		async writeFile(path, content) {
			await fsWriteFile(path, content, "utf8");
		},
		async mkdir(path) {
			await fsMkdir(path, { recursive: true });
		},
		async execFile(command, args): Promise<ExecResult> {
			try {
				const { stdout, stderr } = await execFileAsync(command, args);
				return { code: 0, stdout, stderr };
			} catch (error) {
				const failure = error as { code?: unknown; stdout?: string; stderr?: string };
				const code = typeof failure.code === "number" ? failure.code : 1;
				return { code, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
			}
		},
	};
}
