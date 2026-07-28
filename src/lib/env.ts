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
	/**
	 * Creates or replaces a file. `mode` is applied at creation, not after — a
	 * file that will hold credentials must never exist, even briefly, with
	 * looser permissions than it ends up with.
	 */
	writeFile(path: string, content: string, options?: { mode?: number }): Promise<void>;
	/**
	 * Atomically replaces `to` with `from`. Used for edits to files the user
	 * already owns, where a partial write would be worse than no write at all.
	 * Must be a same-directory move so the rename is atomic.
	 */
	rename(from: string, to: string): Promise<void>;
	/** Deletes a file; resolves quietly when it is already gone. */
	removeFile(path: string): Promise<void>;
	/**
	 * Resolves symlinks to the real file. Returns the input unchanged when the
	 * path does not exist, so callers can use it before creating a file.
	 */
	realpath(path: string): Promise<string>;
	/** Permission bits of an existing file, or `undefined` when it is absent. */
	fileMode(path: string): Promise<number | undefined>;
	chmod(path: string, mode: number): Promise<void>;
	/** Recursive mkdir; no-op if the directory already exists. */
	mkdir(path: string): Promise<void>;
	/** Never rejects on a non-zero exit — callers inspect `code`. */
	execFile(command: string, args: readonly string[]): Promise<ExecResult>;
}
