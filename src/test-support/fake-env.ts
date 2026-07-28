import type { Env, ExecResult } from "../lib/env";

export type FakeEnvCalls = {
	writeFile: Array<{ path: string; content: string; mode?: number }>;
	rename: Array<{ from: string; to: string }>;
	removeFile: string[];
	chmod: Array<{ path: string; mode: number }>;
	mkdir: string[];
	execFile: Array<{ command: string; args: string[] }>;
};

export type FakeEnvInit = {
	homedir?: string;
	platform?: NodeJS.Platform;
	pathDirs?: string[];
	pathExt?: string[];
	/** Absolute paths that should behave as executables found on PATH. */
	executables?: string[];
	/** Absolute paths (typically directories) that should exist, beyond seeded files. */
	existingPaths?: string[];
	/** Seed file contents; seeding a path also makes it "exist". */
	files?: Record<string, string>;
	execFile?: (command: string, args: readonly string[]) => ExecResult | Promise<ExecResult>;
	/** Throw from writeFile for these paths, to exercise interrupted-write handling. */
	failWritesTo?: readonly string[];
	/** Symlink path -> resolved target, so realpath behaves like a real link. */
	symlinks?: Record<string, string>;
	/** Seed permission bits per path. */
	modes?: Record<string, number>;
};

/**
 * An in-memory fake of {@link Env} for tests — this is the fs/child_process
 * boundary the installer's own logic gets mocked at. Nothing here touches a
 * real disk or spawns a real process.
 */
export function createFakeEnv(init: FakeEnvInit = {}) {
	const files = new Map<string, string>(Object.entries(init.files ?? {}));
	const existingPaths = new Set<string>(init.existingPaths ?? []);
	const executables = new Set<string>(init.executables ?? []);
	const calls: FakeEnvCalls = {
		writeFile: [],
		rename: [],
		removeFile: [],
		chmod: [],
		mkdir: [],
		execFile: [],
	};
	const symlinks = new Map<string, string>(Object.entries(init.symlinks ?? {}));
	const modes = new Map<string, number>(
		Object.entries(init.modes ?? {}).map(([key, value]) => [key, value]),
	);
	const failWritesTo = new Set<string>(init.failWritesTo ?? []);

	const env: Env = {
		platform: init.platform ?? "darwin",
		homedir: () => init.homedir ?? "/home/fake-user",
		pathDirs: () => init.pathDirs ?? ["/usr/local/bin", "/usr/bin"],
		pathExt: () => init.pathExt ?? [""],
		async fileExists(path) {
			const resolved = symlinks.get(path) ?? path;
			return files.has(resolved) || existingPaths.has(resolved);
		},
		async isExecutableFile(path) {
			return executables.has(path);
		},
		async readFile(path) {
			// Real readFile follows symlinks; modelling that keeps a link-aware bug
			// from hiding behind the fake.
			return files.get(symlinks.get(path) ?? path);
		},
		async writeFile(path, content, options) {
			calls.writeFile.push({ path, content, mode: options?.mode });
			if (failWritesTo.has(path)) throw new Error(`fake write failure: ${path}`);
			files.set(path, content);
			if (options?.mode !== undefined) modes.set(path, options.mode);
		},
		async rename(from, to) {
			calls.rename.push({ from, to });
			const content = files.get(from);
			if (content === undefined) throw new Error(`fake rename of missing file: ${from}`);
			files.delete(from);
			files.set(to, content);
			const mode = modes.get(from);
			modes.delete(from);
			if (mode !== undefined) modes.set(to, mode);
		},
		async removeFile(path) {
			calls.removeFile.push(path);
			files.delete(path);
		},
		async realpath(path) {
			return symlinks.get(path) ?? path;
		},
		async fileMode(path) {
			if (!files.has(path)) return undefined;
			return modes.get(path);
		},
		async chmod(path, mode) {
			calls.chmod.push({ path, mode });
			modes.set(path, mode);
		},
		async mkdir(path) {
			calls.mkdir.push(path);
			existingPaths.add(path);
		},
		async execFile(command, args) {
			calls.execFile.push({ command, args: [...args] });
			if (init.execFile) return init.execFile(command, args);
			return { code: 0, stdout: "", stderr: "" };
		},
	};

	return { env, calls, files, modes, existingPaths, executables };
}
