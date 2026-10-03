import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { budgetFailures, createAssetReport } from "./asset-report.mjs";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const directory = path.resolve(process.argv[2] ?? path.join(webRoot, "dist"));
const budgets = JSON.parse(
  await readFile(path.join(webRoot, "asset-budgets.json"), "utf8"),
);
const report = await createAssetReport(directory, Object.keys(budgets.routes));
await writeFile(
  path.join(directory, ".vite/asset-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `Initial JS: ${report.initialJs.transferBytes} gzip bytes; all initial assets: ${report.initial.transferBytes} bytes`,
);
const failures = budgetFailures(report, budgets);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log("Asset budgets passed.");
