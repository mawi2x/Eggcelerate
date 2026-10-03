import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

export function reachableFiles(manifest, root) {
  const seen = new Set();
  const files = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk?.file) throw new Error(`Missing manifest chunk: ${key}`);
    files.add(chunk.file);
    for (const file of [...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
      files.add(file);
    }
    for (const dependency of chunk.imports ?? []) visit(dependency);
  }
  visit(root);
  return [...files].sort();
}

export async function createAssetReport(directory, routeKeys) {
  const manifest = JSON.parse(
    await readFile(path.join(directory, ".vite/manifest.json"), "utf8"),
  );
  const cache = new Map();
  async function measure(file) {
    if (!cache.has(file)) {
      const body = await readFile(path.join(directory, file));
      cache.set(file, {
        file,
        bytes: body.length,
        transferBytes: /\.(js|css|html)$/.test(file)
          ? gzipSync(body).length
          : body.length,
      });
    }
    return cache.get(file);
  }
  function totals(files) {
    return files.reduce(
      (sum, file) => ({
        bytes: sum.bytes + file.bytes,
        transferBytes: sum.transferBytes + file.transferBytes,
      }),
      { bytes: 0, transferBytes: 0 },
    );
  }
  const initialFiles = reachableFiles(manifest, "index.html");
  const html = await readFile(path.join(directory, "index.html"), "utf8");
  const externalAssets = new Set();
  // Count all declared icons; the browser chooses which ones to request.
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const href = tag[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    if (/^(https?:)?\/\//.test(href)) externalAssets.add(href);
    else initialFiles.push(href.replace(/^\//, ""));
  }
  async function expandStyles(files) {
    const all = new Set(files);
    const visited = new Set();
    for (const file of all) {
      if (!file.endsWith(".css") || visited.has(file)) continue;
      visited.add(file);
      const css = await readFile(path.join(directory, file), "utf8");
      for (const match of css.matchAll(
        /(?:url\(\s*["']?|@import\s*["'])([^\s"');]+)/g,
      )) {
        const url = match[1];
        if (/^(data:|#)/.test(url)) continue;
        if (/^(https?:)?\/\//.test(url)) externalAssets.add(url);
        else {
          const local = new URL(url, `https://assets.invalid/${file}`).pathname;
          all.add(decodeURIComponent(local).replace(/^\//, ""));
        }
      }
    }
    return [...all];
  }
  const expandedInitial = await expandStyles(initialFiles);
  const initial = await Promise.all(
    [...new Set([...expandedInitial, "index.html"])].map(measure),
  );
  const initialSet = new Set(expandedInitial);
  const routes = {};
  for (const key of routeKeys) {
    const files = await Promise.all(
      (await expandStyles(reachableFiles(manifest, key))).map(measure),
    );
    const additional = files.filter((file) => !initialSet.has(file.file));
    routes[key] = { files: additional, ...totals(additional) };
  }
  const chunks = await Promise.all(
    [...new Set(Object.values(manifest).map((chunk) => chunk.file))]
      .filter((file) => file.endsWith(".js"))
      .map(measure),
  );
  return {
    assumptions:
      "gzip JS/CSS/HTML; binary assets raw; all declared font subsets and HTML-linked icons counted; excludes API, headers and server compression differences",
    externalAssets: [...externalAssets],
    entry: await measure(manifest["index.html"].file),
    initial: { files: initial, ...totals(initial) },
    initialJs: totals(initial.filter((file) => file.file.endsWith(".js"))),
    initialCss: totals(initial.filter((file) => file.file.endsWith(".css"))),
    routes,
    chunks,
  };
}

export function budgetFailures(report, budgets) {
  const failures = [];
  if (report.externalAssets?.length) {
    failures.push(
      `Unbudgeted external assets: ${report.externalAssets.join(", ")}`,
    );
  }
  function check(label, actual, limit) {
    if (!Number.isFinite(actual) || !Number.isFinite(limit) || actual > limit) {
      failures.push(`${label}: ${actual} bytes exceeds ${limit}`);
    }
  }
  check("entry gzip", report.entry.transferBytes, budgets.entryGzipBytes);
  check(
    "initial JS gzip",
    report.initialJs.transferBytes,
    budgets.initialJsGzipBytes,
  );
  check(
    "initial CSS gzip",
    report.initialCss.transferBytes,
    budgets.initialCssGzipBytes,
  );
  check(
    "initial assets",
    report.initial.transferBytes,
    budgets.initialTransferBytes,
  );
  for (const chunk of report.chunks) {
    check(chunk.file, chunk.bytes, budgets.chunkBytes);
  }
  for (const [key, limit] of Object.entries(budgets.routes)) {
    if (!report.routes[key]) failures.push(`Missing route report: ${key}`);
    else check(key, report.routes[key].transferBytes, limit);
  }
  return failures;
}
