import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    globals: false,

    coverage: {
      provider: "v8",
      exclude: ["src/**/test-utils.ts"],
    },
  },
});
