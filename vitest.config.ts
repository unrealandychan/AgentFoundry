import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/skill-store.ts",
        "src/lib/skill-bindings.ts",
        "src/lib/**/__tests__/**",
        "src/lib/**/*.test.ts",
        "src/lib/**/*.spec.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
