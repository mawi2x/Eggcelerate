import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
  budgetFailures,
  createAssetReport,
  reachableFiles,
} from "./asset-report.mjs";

test("static closure deduplicates cycles and shared assets without eagerly counting dynamic routes", () => {
  const manifest = {
    entry: {
      file: "entry.js",
      imports: ["shared"],
      dynamicImports: ["route"],
      css: ["app.css"],
    },
    shared: { file: "shared.js", imports: ["entry"], assets: ["font.woff2"] },
    route: { file: "route.js", imports: ["shared"] },
  };
  assert.deepEqual(reachableFiles(manifest, "entry"), [
    "app.css",
    "entry.js",
    "font.woff2",
    "shared.js",
  ]);
  assert.throws(() => reachableFiles(manifest, "missing"), /Missing manifest/);
  assert.throws(
    () =>
      reachableFiles(
        { entry: { file: "a.js", imports: ["missing"] } },
        "entry",
      ),
    /Missing manifest/,
  );
});

test("real reports count binary assets, shared route dependencies, and fail closed on missing files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "egg-assets-"));
  try {
    await mkdir(path.join(directory, ".vite"));
    const manifest = {
      "index.html": {
        file: "entry.js",
        imports: ["shared"],
        css: ["app.css"],
        assets: ["font.woff2"],
      },
      shared: { file: "shared.js" },
      route: {
        file: "route.js",
        imports: ["shared", "extra"],
        assets: ["photo.webp"],
      },
      extra: { file: "extra.js" },
    };
    const bodies = {
      "entry.js": "entry".repeat(50),
      "shared.js": "shared".repeat(50),
      "route.js": "route".repeat(50),
      "extra.js": "extra".repeat(50),
      "app.css": "css".repeat(50),
      "index.html": "html",
      "font.woff2": "font",
      "photo.webp": "photo",
    };
    await writeFile(
      path.join(directory, ".vite/manifest.json"),
      JSON.stringify(manifest),
    );
    for (const [file, body] of Object.entries(bodies))
      await writeFile(path.join(directory, file), body);
    const report = await createAssetReport(directory, ["route"]);
    assert.equal(
      report.initialJs.transferBytes,
      gzipSync(bodies["entry.js"]).length +
        gzipSync(bodies["shared.js"]).length,
    );
    assert.equal(
      report.routes.route.transferBytes,
      gzipSync(bodies["route.js"]).length +
        gzipSync(bodies["extra.js"]).length +
        5,
    );
    assert.equal(
      report.initial.files.find((file) => file.file === "font.woff2")
        .transferBytes,
      4,
    );
    const budgets = {
      entryGzipBytes: 1000,
      initialJsGzipBytes: 1000,
      initialCssGzipBytes: 1000,
      initialTransferBytes: 1000,
      chunkBytes: 1000,
      routes: { route: 1000 },
    };
    assert.deepEqual(budgetFailures(report, budgets), []);
    assert.equal(
      budgetFailures(report, {
        ...budgets,
        initialTransferBytes: 1,
        routes: { route: 1, absent: 1 },
      }).length,
      3,
    );
    assert.ok(budgetFailures(report, { ...budgets, chunkBytes: 1 }).length > 0);
    await writeFile(path.join(directory, "public-font.woff2"), "public font");
    await writeFile(
      path.join(directory, "app.css"),
      '@font-face{src:url("/public-font.woff2")}',
    );
    const publicFont = await createAssetReport(directory, ["route"]);
    assert.equal(
      publicFont.initial.files.find((file) => file.file === "public-font.woff2")
        .transferBytes,
      11,
    );
    await writeFile(
      path.join(directory, "app.css"),
      '@import url("https://example.test/fonts.css");',
    );
    const external = await createAssetReport(directory, ["route"]);
    assert.ok(
      budgetFailures(external, budgets).some((message) =>
        message.includes("Unbudgeted external assets"),
      ),
    );
    await rm(path.join(directory, "font.woff2"));
    await assert.rejects(createAssetReport(directory, ["route"]), /ENOENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
