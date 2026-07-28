import type { Env, ExecResult } from "../lib/env";

export type FakeEnvCalls = {
	writeFile: Array<{ path: string; content: string }>;
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
	const calls: FakeEnvCalls = { writeFile: [], mkdir: [], execFile: [] };

	const env: Env = {
		platform: init.platform ?? "darwin",
		homedir: () => init.homedir ?? "/home/fake-user",
		pathDirs: () => init.pathDirs ?? ["/usr/local/bin", "/usr/bin"],
		pathExt: () => init.pathExt ?? [""],
		async fileExists(path) {
			return files.has(path) || existingPaths.has(path);
		},
		async isExecutableFile(path) {
			return executables.has(path);
		},
		async readFile(path) {
			return files.get(path);
		},
		async writeFile(path, content) {
			calls.writeFile.push({ path, content });
			files.set(path, content);
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

	return { env, calls, files, existingPaths, executables };
}
