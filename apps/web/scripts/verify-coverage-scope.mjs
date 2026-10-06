import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDirectory, "..");
const screenDirectories = ["screens", "trends", "incubators"].map((directory) =>
  path.join(appRoot, "src/app/components", directory),
);
const coverageFile = path.join(appRoot, "coverage/coverage-final.json");

function listScreens(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listScreens(entryPath);
    return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

const expectedScreens = screenDirectories
  .flatMap(listScreens)
  .map((file) => path.resolve(file));
const report = JSON.parse(readFileSync(coverageFile, "utf8"));
const coveredFiles = new Set(
  Object.keys(report).map((file) => path.resolve(appRoot, file)),
);
const missingScreens = expectedScreens.filter(
  (file) => !coveredFiles.has(file),
);

if (expectedScreens.length === 0 || missingScreens.length > 0) {
  console.error("Coverage is missing screen modules:");
  for (const file of missingScreens) {
    console.error(`- ${path.relative(appRoot, file)}`);
  }
  process.exit(1);
}

console.log(
  `Coverage includes all ${expectedScreens.length} screen and extracted feature modules.`,
);
