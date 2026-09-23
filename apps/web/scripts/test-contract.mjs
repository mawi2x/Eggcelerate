import { spawnSync } from "node:child_process";

const configuredUrl = process.env.EGG_API_URL;
if (!configuredUrl) {
  console.error(
    "Set EGG_API_URL to a local, disposable API before running test:contract.",
  );
  process.exit(1);
}

let apiUrl;
try {
  apiUrl = new URL(configuredUrl);
} catch {
  console.error("EGG_API_URL must be a valid URL.");
  process.exit(1);
}

if (
  !(
    apiUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(apiUrl.hostname)
  )
) {
  console.error("test:contract only accepts an HTTP loopback API URL.");
  process.exit(1);
}

const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "src/tests/repository-contract.test.ts"],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
