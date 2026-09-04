import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      // Rendered screens/components stay reported but outside the gate until
      // rendered coverage exists (see restructuring guide F6). The gate below
      // pins the tested logic core (domain, data, features, providers,
      // routing) as a ratchet — raise, never lower.
      include: [
        "src/app/domain/**",
        "src/app/data/**",
        "src/app/features/**",
        "src/app/providers/**",
        "src/app/routing/**",
      ],
      thresholds: { lines: 75, functions: 55, branches: 65 },
    },
  },
});
