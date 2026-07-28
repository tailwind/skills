import { defineConfig } from "vitest/config";

// Standalone equivalent of the source monorepo's shared test config. This repo
// is a published mirror with no monorepo above it, so the config cannot import
// `../../vitest.shared.mjs` the way the in-monorepo package does.
export default defineConfig({
	test: {
		globals: true,
	},
});
