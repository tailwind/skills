import { execFile as execFileCb } from "node:child_process";
import {
	access,
	constants,
	chmod as fsChmod,
	mkdir as fsMkdir,
	readFile as fsReadFile,
	readlink as fsReadlink,
	realpath as fsRealpath,
	rename as fsRename,
	rm as fsRm,
	stat as fsStat,
	writeFile as fsWriteFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, dirname, resolve } from "node:path";
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
		async writeFile(path, content, options) {
			// mode is honoured only when the file is created, which is exactly the
			// case that matters: the temp file must never briefly exist at the
			// umask default while holding credentials.
			await fsWriteFile(path, content, { encoding: "utf8", mode: options?.mode });
		},
		async rename(from, to) {
			await fsRename(from, to);
		},
		async removeFile(path) {
			await fsRm(path, { force: true });
		},
		async realpath(path) {
			try {
				return await fsRealpath(path);
			} catch (error) {
				if (!isEnoent(error)) throw error;
				// realpath fails on a dangling symlink as well as on a plain missing
				// file. Those are different: a dangling link still names the file the
				// user means, and renaming over the link itself would detach a
				// dotfiles-managed path. Fall back to link semantics.
				try {
					const target = await fsReadlink(path);
					return resolve(dirname(path), target);
				} catch {
					// Not a symlink — genuinely absent, so it resolves to itself.
					return path;
				}
			}
		},
		async fileMode(path) {
			try {
				return (await fsStat(path)).mode & 0o777;
			} catch (error) {
				if (isEnoent(error)) return undefined;
				throw error;
			}
		},
		async chmod(path, mode) {
			await fsChmod(path, mode);
		},
		async mkdir(path) {
			await fsMkdir(path, { recursive: true });
		},
		async execFile(command, args): Promise<ExecResult> {
			try {
				// On Windows the agent CLIs are usually npm command shims
				// (claude.cmd, codex.cmd). Node cannot spawn .cmd/.bat directly, so
				// detection would succeed and the install would then fail at the
				// exec. Routing through the shell there is what makes those shims
				// runnable. Every argument we pass is a build-time constant, so the
				// usual shell-injection concern does not apply.
				const { stdout, stderr } = await execFileAsync(command, args, {
					shell: process.platform === "win32",
				});
				return { code: 0, stdout, stderr };
			} catch (error) {
				const failure = error as { code?: unknown; stdout?: string; stderr?: string };
				const code = typeof failure.code === "number" ? failure.code : 1;
				return { code, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
			}
		},
	};
}
