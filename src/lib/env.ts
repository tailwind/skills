/**
 * Everything the installer touches outside its own process — the
 * filesystem, PATH, and child processes — goes through this interface.
 * Production code gets the real Node implementation (./node-env); tests
 * supply an in-memory fake, so unit tests mock at this boundary rather than
 * the installer logic itself.
 */
export type ExecResult = Readonly<{
	code: number;
	stdout: string;
	stderr: string;
}>;

export interface Env {
	readonly platform: NodeJS.Platform;
	homedir(): string;
	/** Directories on PATH, in search order. */
	pathDirs(): string[];
	/** Executable suffixes to try per PATH dir (`[""]` on POSIX, `[".EXE", ".CMD", ...]` on Windows). */
	pathExt(): string[];
	/** True if a regular file exists (does not imply readability or executability). */
	fileExists(path: string): Promise<boolean>;
	/** True if the file exists and is executable by the current user. */
	isExecutableFile(path: string): Promise<boolean>;
	/** Reads a UTF-8 file; resolves `undefined` (not a rejection) when the file does not exist. */
	readFile(path: string): Promise<string | undefined>;
	writeFile(path: string, content: string): Promise<void>;
	/** Recursive mkdir; no-op if the directory already exists. */
	mkdir(path: string): Promise<void>;
	/** Never rejects on a non-zero exit — callers inspect `code`. */
	execFile(command: string, args: readonly string[]): Promise<ExecResult>;
}
