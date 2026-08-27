import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    coverage: { provider: "v8", reportsDirectory: "./coverage", thresholds: { lines: 80, functions: 80, branches: 70 } },
  },
});
