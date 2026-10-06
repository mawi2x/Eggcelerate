import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: {
    include: ["src/tests/**/*.test.{ts,tsx}"],
    maxWorkers: 2,
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "html", "json"],
      // Core behavior keeps a strict measured floor. Screen and rendered
      // component groups have separate floors, and the coverage script verifies
      // that every screen module is present in the JSON report.
      include: [
        "src/app/domain/**/*.{ts,tsx}",
        "src/app/data/**/*.{ts,tsx}",
        "src/app/features/**/*.{ts,tsx}",
        "src/app/providers/**/*.{ts,tsx}",
        "src/app/routing/**/*.{ts,tsx}",
        "src/app/components/screens/**/*.{ts,tsx}",
        "src/app/components/trends/**/*.{ts,tsx}",
        "src/app/components/incubators/**/*.{ts,tsx}",
        "src/app/components/auth/**/*.{ts,tsx}",
        "src/app/components/AppSidebar.tsx",
        "src/app/components/PageHeader.tsx",
        "src/app/components/IncubatorCard.tsx",
        "src/app/components/OverviewSummary.tsx",
        "src/app/components/settings/HardwarePanel.tsx",
        "src/app/components/ui/filter-bar.tsx",
        "src/app/components/ui/typography.tsx",
        "src/app/components/detail/Timeline.tsx",
      ],
      thresholds: {
        "src/app/{domain,data,features,providers,routing}/**": {
          lines: 90,
          functions: 88,
          branches: 81,
        },
        "src/app/components/{screens,trends,incubators}/**": {
          lines: 50,
          functions: 28,
          branches: 60,
        },
        "src/app/components/auth/**": {
          lines: 50,
          functions: 45,
          branches: 35,
        },
        "src/app/components/AppSidebar.tsx": {
          lines: 55,
          functions: 15,
          branches: 65,
        },
        "src/app/components/PageHeader.tsx": {
          lines: 65,
          functions: 60,
          branches: 45,
        },
        "src/app/components/IncubatorCard.tsx": {
          lines: 70,
          functions: 30,
          branches: 60,
        },
        "src/app/components/OverviewSummary.tsx": {
          lines: 80,
          functions: 80,
          branches: 60,
        },
        "src/app/components/settings/HardwarePanel.tsx": {
          lines: 65,
          functions: 30,
          branches: 45,
        },
        "src/app/components/ui/filter-bar.tsx": {
          lines: 80,
          functions: 75,
          branches: 65,
        },
        "src/app/components/ui/typography.tsx": {
          lines: 90,
          functions: 90,
          branches: 85,
        },
        "src/app/components/detail/Timeline.tsx": {
          lines: 80,
          functions: 30,
          branches: 35,
        },
      },
    },
  },
});
