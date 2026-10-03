import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function moduleSizes(): Plugin {
  return {
    name: "module-sizes",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle)
        .filter((item) => item.type === "chunk")
        .map((chunk) => ({
          file: chunk.fileName,
          modules: Object.entries(chunk.modules)
            .map(([id, module]) => ({
              id: path.relative(import.meta.dirname, id),
              bytes: module.renderedLength,
            }))
            .filter((module) => module.bytes > 0)
            .sort((a, b) => b.bytes - a.bytes),
        }));
      this.emitFile({
        type: "asset",
        fileName: ".vite/module-sizes.json",
        source: JSON.stringify(chunks, null, 2),
      });
    },
  };
}

function figmaAssetResolver() {
  return {
    name: "figma-asset-resolver",
    resolveId(id) {
      if (id.startsWith("figma:asset/")) {
        const filename = id.replace("figma:asset/", "");
        return path.resolve(import.meta.dirname, "src/assets", filename);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    moduleSizes(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ["**/*.svg", "**/*.csv"],
  server: {
    allowedHosts: [".trycloudflare.com"],
  },
  build: {
    // Preserve Vite 6's JavaScript target during the bundler migration.
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
    manifest: true,
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor",
              test: /\/node_modules\/(react|react-dom|scheduler)\//,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
});
