import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const requireWeb = createRequire(path.join(root, "apps/web/package.json"));
const ts = requireWeb("typescript");
const postcss = createRequire(requireWeb.resolve("vite/package.json"))(
  "postcss",
);
const output = path.resolve(
  root,
  process.argv[2] ?? "docs/refine/sizing-audit-2026-10-03",
);
const files = execFileSync("rg", ["--files", "apps"], {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter((file) => /\.(?:css|tsx?|jsx?|html|svg)$/.test(file))
  .filter(
    (file) =>
      !/\/(?:node_modules|dist|coverage|\.venv|tests|hardware)\//.test(file),
  )
  .sort();
const rows = [];
const references = [];
const utilities = [];
const definitions = [];
const review = [];
const manifests = [];
const seen = new Set();
const categoryOf = (property) => {
  if (!property) return null;
  const p = property.replaceAll("-", "").toLowerCase();
  if (/^type|fontsize|labelsize|valuesize|subtextsize|ticksize/.test(p))
    return "font size";
  if (/lineheight|leading/.test(p)) return "line height";
  if (/radius|rounded/.test(p)) return "border radius";
  if (/strokewidth/.test(p)) return "icon/vector stroke";
  if (
    /^(size|glyph|iconsize)$|statusiconbadge|controlsize|hitarea|dotsize/.test(
      p,
    )
  )
    return "icon size";
  if (/border|outline|ringwidth/.test(p)) return "border width";
  if (/filter|blur/.test(p)) return "filter geometry";
  if (/backgroundimage/.test(p)) return "background geometry";
  if (/shadow/.test(p)) return "shadow geometry";
  if (/letterspacing|tracking/.test(p)) return "letter spacing";
  if (/measure|width|^.*_w$/.test(p)) return "width";
  if (/thickness|height|^.*_h$/.test(p)) return "height";
  if (
    /clearance|padding|margin|gap|top$|bottom$|left$|right$|inset|transform|translate|offset|indent|scrollpadding/.test(
      p,
    )
  )
    return "spacing/position";
  return null;
};
function location(file, source, offset) {
  const before = source.slice(0, offset);
  const line = before.split("\n").length;
  return { file, line, column: offset - before.lastIndexOf("\n") };
}
function componentOf(file) {
  return file.startsWith("apps/web/src/app/")
    ? file.slice("apps/web/src/app/".length).replace(/\.[^.]+$/, "")
    : file.replace(/^apps\/web\//, "");
}
function record(
  file,
  source,
  offset,
  property,
  value,
  unit,
  syntax,
  bucket = "direct",
  owner = "",
) {
  const loc = location(file, source, offset);
  const key = `${file}:${offset}:${unit}`;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({
    ...loc,
    component: componentOf(file),
    owner,
    property,
    category: categoryOf(property) ?? "review",
    value: Number(value),
    unit,
    size: `${Number(value)}${unit === "ratio" ? " (unitless)" : unit === "svg-unit" ? " (SVG units)" : unit}`,
    syntax,
    bucket,
    excerpt: source.split("\n")[loc.line - 1].trim(),
  });
}
function refs(file, source, text, start, property, bucket) {
  for (const match of text.matchAll(/--[a-zA-Z][\w-]*/g)) {
    references.push({
      ...location(file, source, start + match.index),
      component: componentOf(file),
      property,
      token: match[0],
      bucket,
    });
  }
}
function utilityProperty(text, index) {
  const prefix = text.slice(0, index);
  const match = prefix.match(
    /(?:^|[\s:"'`])(?:[\w@./[\]()%,-]+:)*(-?)([\w-]+)-\[[^\]]*$/,
  );
  if (!match) return null;
  const utility = match[2];
  if (/^(?:min-|max-)?w$/.test(utility)) return utility.replace(/w$/, "width");
  if (/^(?:min-|max-)?h$/.test(utility)) return utility.replace(/h$/, "height");
  if (utility === "size") return "width/height";
  if (/^p[xytrblse]?$/.test(utility)) return "padding";
  if (/^m[xytrblse]?$/.test(utility)) return "margin";
  if (utility === "text") return "fontSize";
  if (utility === "leading") return "lineHeight";
  if (utility.startsWith("rounded")) return "borderRadius";
  if (utility.startsWith("border")) return "borderWidth";
  if (utility.startsWith("ring")) return "ringWidth";
  if (utility.includes("blur")) return "filter";
  if (utility.startsWith("stroke")) return "strokeWidth";
  if (utility.startsWith("shadow")) return "boxShadow";
  if (
    /gap|space-[xy]|inset|top|bottom|left|right|translate|scroll/.test(utility)
  )
    return utility;
  return null;
}
function scanString(
  file,
  source,
  text,
  start,
  property,
  syntax,
  bucket = "direct",
  owner = "",
) {
  refs(file, source, text, start, property, bucket);
  const isClass =
    property === "className" ||
    property === "@apply" ||
    /(?:^|\s)(?:[\w-]+:)*(?:w|h|min-h|max-h|min-w|max-w|rounded|p|gap)-\[/.test(
      text,
    );
  if (isClass) {
    for (const match of text.matchAll(
      /(?:^|\s)((?:[^\s]*:)?(?:-?)(?:(?:min-|max-)?[wh]|size|[pm][xytrblse]?|gap(?:-[xy])?|space-[xy]|rounded(?:-[\w]+)?|border(?:-[trblxyse])?|text|leading|top|bottom|left|right|inset(?:-[xy])?|translate-[xy]|tracking)-(?:\d+(?:\.\d+)?|px|xs|sm|base|lg|xl|\d+xl|none|full))/g,
    )) {
      utilities.push({
        ...location(file, source, start + match.index),
        component: componentOf(file),
        utility: match[1],
        property: "Tailwind built-in scale",
        bucket,
      });
    }
    for (const match of text.matchAll(/leading-\[(-?\d*\.?\d+)\]/g))
      record(
        file,
        source,
        start + match.index,
        "lineHeight",
        match[1],
        "ratio",
        "arbitrary utility",
        bucket,
        owner,
      );
  }
  for (const match of text.matchAll(
    /(?<![\w#])(-?\d*\.?\d+)(px|rem|em|%|dvh|svh|vh|vw|vmin|vmax|ch)(?![a-zA-Z])/g,
  )) {
    let prop = property;
    let kind = syntax;
    if (isClass) {
      if (/(?:min|max)-\[$/.test(text.slice(0, match.index))) {
        record(
          file,
          source,
          start + match.index,
          "width",
          match[1],
          match[2],
          "utility breakpoint",
          "breakpoint",
          owner,
        );
        continue;
      }
      prop = utilityProperty(text, match.index);
      kind = "arbitrary utility";
    } else if (!categoryOf(prop)) {
      const cssPrefix = text
        .slice(0, match.index)
        .match(/([a-zA-Z-]+)\s*:\s*[^;{}]*$/);
      if (cssPrefix) prop = cssPrefix[1];
    }
    if (!categoryOf(prop)) {
      if (
        match[2] === "%" &&
        /^(backgroundColor|saveModal|label|message)$/.test(property)
      )
        continue;
      review.push({
        ...location(file, source, start + match.index),
        property,
        literal: match[0],
        excerpt: source
          .split("\n")
          [location(file, source, start + match.index).line - 1].trim(),
      });
      continue;
    }
    const unit =
      categoryOf(prop) === "icon/vector stroke" && match[2] === "px"
        ? "px"
        : match[2];
    record(
      file,
      source,
      start + match.index,
      prop,
      match[1],
      unit,
      kind,
      bucket,
      owner,
    );
  }
}
function parseCss(file, source, base = 0, owner = "") {
  const sheet = postcss.parse(source, { from: file });
  sheet.walkDecls((decl) => {
    const start = base + decl.source.start.offset;
    const valueStart =
      start + decl.prop.length + (decl.raws.between ?? ":").length;
    const full = readFileSync(path.join(root, file), "utf8");
    if (decl.prop.startsWith("--")) {
      const context = [];
      for (let parent = decl.parent; parent; parent = parent.parent) {
        if (parent.type === "atrule")
          context.unshift(`@${parent.name} ${parent.params}`);
        if (parent.type === "rule") context.push(parent.selector);
      }
      definitions.push({
        ...location(file, full, start),
        token: decl.prop,
        value: decl.value,
        context: context.join(" / ") || "root",
      });
      scanString(
        file,
        full,
        decl.value,
        valueStart,
        decl.prop.replace(/^--/, ""),
        "CSS token definition",
        "token definition",
        owner,
      );
      if (/^--leading-/.test(decl.prop) && /^\d*\.?\d+$/.test(decl.value))
        record(
          file,
          full,
          valueStart,
          "lineHeight",
          decl.value,
          "ratio",
          "CSS token definition",
          "token definition",
          owner,
        );
    } else {
      scanString(
        file,
        full,
        decl.value,
        valueStart,
        decl.prop,
        base ? "embedded CSS" : "CSS declaration",
        "direct",
        owner,
      );
      if (decl.prop === "line-height" && /^\d*\.?\d+$/.test(decl.value))
        record(
          file,
          full,
          valueStart,
          decl.prop,
          decl.value,
          "ratio",
          "CSS declaration",
          "direct",
          owner,
        );
    }
  });
  sheet.walkAtRules((rule) => {
    if (rule.name === "apply")
      scanString(
        file,
        readFileSync(path.join(root, file), "utf8"),
        rule.params,
        base + rule.source.start.offset + 7,
        "@apply",
        "CSS utility",
      );
    if (rule.name === "media")
      scanString(
        file,
        readFileSync(path.join(root, file), "utf8"),
        rule.params,
        base + rule.source.start.offset + 7,
        "width",
        "media query",
        "breakpoint",
      );
  });
}
function contextOf(node, sourceFile) {
  let property = "";
  let owner = "";
  let bucket = "direct";
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isTypeNode(parent)) return null;
    if (!owner && ts.isFunctionDeclaration(parent) && parent.name)
      owner = parent.name.text;
    if (
      !property &&
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
    )
      property = parent.left.getText(sourceFile);
    if (
      !property &&
      (ts.isJsxAttribute(parent) || ts.isPropertyAssignment(parent))
    )
      property = parent.name.getText(sourceFile).replace(/['"]/g, "");
    if (
      !property &&
      ts.isBindingElement(parent) &&
      parent.initializer &&
      node.pos >= parent.initializer.pos
    ) {
      property = parent.name.getText(sourceFile);
      bucket = "component default";
    }
    if (!property && ts.isParameter(parent) && parent.initializer) {
      property = parent.name.getText(sourceFile);
      bucket = "component default";
    }
    if (!property && ts.isVariableDeclaration(parent)) {
      property = parent.name.getText(sourceFile);
      bucket = "component constant";
    }
    if (
      ts.isCallExpression(parent) &&
      /^(?:cn|clsx|cva)$/.test(parent.expression.getText(sourceFile))
    )
      property = "className";
  }
  return { property, owner, bucket };
}
function parseTs(file, source) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length)
    throw new Error(`Cannot parse ${file}`);
  const walk = (node) => {
    const context = contextOf(node, sourceFile);
    if (
      context &&
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node))
    ) {
      const text = node
        .getText(sourceFile)
        .slice(
          1,
          ts.isTemplateHead(node) || ts.isTemplateMiddle(node) ? -2 : -1,
        );
      scanString(
        file,
        source,
        text,
        node.getStart(sourceFile) + 1,
        context.property,
        "inline string",
        context.bucket,
        context.owner,
      );
    }
    if (context && ts.isNumericLiteral(node) && categoryOf(context.property)) {
      let value = Number(node.text);
      let parent = node.parent;
      if (ts.isPrefixUnaryExpression(parent)) {
        if (parent.operator === ts.SyntaxKind.MinusToken) value = -value;
        parent = parent.parent;
      }
      // Multipliers, percentages, comparison thresholds and pagination counts
      // are not pixel lengths merely because they occur inside a layout formula.
      let arithmeticAncestor = false;
      for (let ancestor = parent; ancestor; ancestor = ancestor.parent) {
        if (
          ts.isPropertyAssignment(ancestor) ||
          ts.isJsxAttribute(ancestor) ||
          ts.isVariableDeclaration(ancestor)
        )
          break;
        if (
          ts.isBinaryExpression(ancestor) &&
          [
            ts.SyntaxKind.AsteriskToken,
            ts.SyntaxKind.SlashToken,
            ts.SyntaxKind.PercentToken,
          ].includes(ancestor.operatorToken.kind)
        )
          arithmeticAncestor = true;
      }
      if (
        !arithmeticAncestor &&
        !(ts.isBinaryExpression(parent) || ts.isCallExpression(parent))
      ) {
        let unit =
          categoryOf(context.property) === "line height"
            ? "ratio"
            : categoryOf(context.property) === "icon/vector stroke"
              ? "svg-unit"
              : "px";
        if (value === 0 && unit === "px") unit = "zero";
        record(
          file,
          source,
          node.getStart(sourceFile),
          context.property,
          value,
          unit,
          "numeric JSX/style/default",
          context.bucket,
          context.owner,
        );
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);
}

for (const file of files) {
  const source = readFileSync(path.join(root, file), "utf8");
  manifests.push({
    file,
    sha256: createHash("sha256").update(source).digest("hex"),
  });
  if (file.endsWith(".css")) parseCss(file, source);
  else if (/\.[jt]sx?$/.test(file)) parseTs(file, source);
  else {
    for (const match of source.matchAll(
      /\b(width|height)\s*=\s*["'](-?\d*\.?\d+)(px|rem|em|%)?["']/g,
    ))
      record(
        file,
        source,
        match.index,
        match[1],
        match[2],
        match[3] ?? "px",
        "asset intrinsic dimensions",
        "asset intrinsic",
      );
    for (const match of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))
      parseCss(file, match[1], match.index + match[0].indexOf(match[1]));
  }
}

const cssDefinitions = new Map();
for (const definition of definitions) {
  if (!cssDefinitions.has(definition.token))
    cssDefinitions.set(definition.token, []);
  cssDefinitions.get(definition.token).push(definition);
}
function tokenValue(name, visited = new Set()) {
  if (visited.has(name)) return null;
  visited.add(name);
  const candidates = cssDefinitions.get(name) ?? [];
  const def =
    candidates.find((item) => !item.context.includes("@media")) ??
    candidates[0];
  if (!def) return null;
  const alias = def.value.match(/^var\((--[\w-]+)\)$/);
  if (alias) return tokenValue(alias[1], visited);
  const literal = def.value.match(/^(-?\d*\.?\d+)(px|rem)?$/);
  return literal
    ? {
        value: Number(literal[1]) * (literal[2] === "rem" ? 16 : 1),
        unit: literal[2] ? "px" : "ratio",
      }
    : null;
}
const fontTokens = {
  8: "--type-label-compact (mobile only)",
  9: "--type-label-micro",
  10: "--type-label-compact",
  11: "--type-label",
  12: "--type-caption",
  13: "--type-body-sm",
  14: "--type-body",
  15: "--type-body-lg",
  16: "--type-heading-sm",
  18: "--type-heading-md",
  20: "--type-heading-lg",
  22: "--type-panel-title",
  24: "--type-page-title",
};
const radiusTokens = {
  3: "--radius-bar",
  6: "--radius-chip",
  10: "--radius-compact",
  12: "--radius-dialog",
  16: "--radius-card",
  9999: "--radius-pill",
};
const heightTokens = {
  24: "--control-height-pill",
  28: "--control-height-chip",
  32: "--control-height-compact",
  34: "--control-height-mobile",
  36: "--control-height-default",
  40: "--control-height-toolbar",
  44: "--control-height-filter-row",
};
const squareTokens = {
  28: "--control-size-xs",
  32: "--control-size-sm",
  36: "--control-size-icon",
  40: "--control-size-nav",
  44: "--control-hit-area-icon",
  52: "--control-size-lg",
  56: "--control-size-photo",
};
function recommend(row) {
  if (row.bucket === "token definition")
    return "Token authoring; not a component bypass";
  if (row.bucket === "asset intrinsic")
    return "Keep intrinsic asset canvas separate from UI tokens";
  if (row.bucket === "breakpoint")
    return "Keep/document breakpoint; not a component size";
  if (row.unit === "zero") return "Keep zero; no token needed";
  if (row.unit === "svg-unit")
    return "Vector stroke units; review icon stroke policy, not CSS px substitution";
  const px = row.unit === "rem" ? row.value * 16 : row.value;
  if (row.category === "line height") {
    const match = [...cssDefinitions.keys()].find(
      (name) =>
        name.startsWith("--leading-") && tokenValue(name)?.value === row.value,
    );
    return (
      match ??
      "No exact leading token; propose a role-based leading token if repeated"
    );
  }
  if (!["px", "rem"].includes(row.unit))
    return "Relative/em sizing; preserve layout or review component role";
  if (row.category === "font size")
    return fontTokens[px]
      ? `${fontTokens[px]}; role + responsive review`
      : "No exact type token; review typography role";
  if (row.category === "border radius")
    return (
      radiusTokens[Math.abs(px)] ?? "No exact radius token; review radius role"
    );
  if (row.category === "border width")
    return Math.abs(px) === 1
      ? "--border-width-hairline"
      : "No exact border token; propose --border-width-strong for repeated 2px strokes";
  if (row.component.endsWith("/StatusIconBadge") && row.property === "glyph")
    return `--status-icon-badge-glyph-${{ 12: "sm", 18: "md", 36: "lg", 22: "banner" }[px]}; existing exact badge role`;
  if (row.category === "icon size")
    return "No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs)";
  if (row.category === "shadow geometry")
    return "Review complete --shadow-* recipe; do not substitute shadow offsets independently";
  if (row.category === "height") {
    if (heightTokens[px])
      return `${heightTokens[px]}; only for matching control role`;
    if (squareTokens[px])
      return `${squareTokens[px]}; only for square controls`;
    if (px === 6) return "--progress-thickness; meter role only";
  }
  if (row.category === "width" || row.property === "width/height") {
    if (squareTokens[px])
      return `${squareTokens[px]}; only for square controls`;
    if (px === 400) return "--dialog-width-narrow; dialog role only";
    if (px === 600) return "--dialog-width-wide; dialog role only";
    if (px === 440) return "--auth-card-width; authentication card only";
    if (px === 136)
      return "--control-width-filter-pill-mobile; filter pill only";
  }
  if (row.category === "spacing/position")
    return "No project spacing scale; prefer matching Tailwind spacing or propose --space-*; preserve positional geometry";
  return "No exact role token; evaluate a component token if repeated";
}
for (const row of rows) row.recommended_token = recommend(row);
const direct = rows.filter((row) =>
  ["direct", "component default", "component constant"].includes(row.bucket),
);
const pixels = direct.filter((row) => row.unit === "px");
const rank = (input) => {
  const map = new Map();
  for (const row of input) {
    const item = map.get(row.size) ?? {
      size: row.size,
      count: 0,
      categories: new Set(),
      components: new Set(),
    };
    item.count++;
    item.categories.add(row.category);
    item.components.add(row.component);
    map.set(row.size, item);
  }
  return [...map.values()]
    .map((item) => ({
      ...item,
      categories: [...item.categories].sort().join(", "),
      components: [...item.components].sort().join(", "),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.size.localeCompare(b.size, undefined, { numeric: true }),
    );
};
const rollups = new Map();
for (const row of direct) {
  const key = [
    row.component,
    row.size,
    row.property,
    row.recommended_token,
  ].join("|");
  const item = rollups.get(key) ?? {
    size: row.size,
    property: row.property,
    category: row.category,
    component: row.component,
    file: row.file,
    locations: [],
    occurrence_count: 0,
    recommended_token: row.recommended_token,
  };
  item.occurrence_count++;
  item.locations.push(`${row.line}:${row.column}`);
  rollups.set(key, item);
}
const grouped = [...rollups.values()].sort(
  (a, b) =>
    a.component.localeCompare(b.component) ||
    b.occurrence_count - a.occurrence_count ||
    a.size.localeCompare(b.size),
);
const componentSummary = [
  ...new Set([
    ...direct.map((row) => row.component),
    ...references.map((row) => row.component),
  ]),
]
  .sort()
  .map((component) => {
    const local = direct.filter((row) => row.component === component);
    const r = rank(local.filter((row) => row.unit === "px"));
    return {
      component,
      raw_pixel_occurrences: r.reduce((sum, row) => sum + row.count, 0),
      other_direct_sizes: local.filter((row) => row.unit !== "px").length,
      token_references: references.filter(
        (row) =>
          row.component === component && row.bucket !== "token definition",
      ).length,
      framework_utilities: utilities.filter(
        (row) => row.component === component,
      ).length,
      most_common: r
        .slice(0, 4)
        .map((row) => `${row.size} × ${row.count}`)
        .join("; "),
      locally_rare: r
        .filter((row) => row.count === 1)
        .map((row) => row.size)
        .join(", "),
    };
  });
function csv(name, data, columns) {
  const escapeCsv = (value) =>
    `"${String(Array.isArray(value) ? value.join("; ") : (value ?? "")).replaceAll('"', '""')}"`;
  writeFileSync(
    path.join(output, name),
    `${[
      columns.map(escapeCsv).join(","),
      ...data.map((row) =>
        columns.map((column) => escapeCsv(row[column])).join(","),
      ),
    ].join("\n")}\n`,
  );
}
const md = (value) =>
  String(value ?? "—")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
function table(data, columns) {
  return [
    `| ${columns.map(([label]) => label).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...data.map(
      (row) => `| ${columns.map(([, key]) => md(row[key])).join(" | ")} |`,
    ),
  ].join("\n");
}
mkdirSync(output, { recursive: true });
csv("occurrences.csv", rows, [
  "size",
  "property",
  "category",
  "component",
  "owner",
  "file",
  "line",
  "column",
  "syntax",
  "bucket",
  "value",
  "unit",
  "recommended_token",
  "excerpt",
]);
csv("component-sizes.csv", grouped, [
  "size",
  "property",
  "component",
  "file",
  "locations",
  "occurrence_count",
  "recommended_token",
]);
csv(
  "component-summary.csv",
  componentSummary,
  Object.keys(componentSummary[0]),
);
csv("pixel-ranking.csv", rank(pixels), [
  "size",
  "count",
  "categories",
  "components",
]);
csv("token-definitions.csv", definitions, [
  "token",
  "value",
  "context",
  "file",
  "line",
  "column",
]);
csv("token-references.csv", references, [
  "token",
  "property",
  "component",
  "file",
  "line",
  "column",
  "bucket",
]);
csv("tailwind-scale-usage.csv", utilities, [
  "utility",
  "property",
  "component",
  "file",
  "line",
  "column",
  "bucket",
]);
csv("review-candidates.csv", review, [
  "literal",
  "property",
  "file",
  "line",
  "column",
  "excerpt",
]);
const summary = {
  scannedFiles: files.length,
  directPixelOccurrences: pixels.length,
  distinctDirectPixelValues: rank(pixels).length,
  buckets: Object.fromEntries(
    [...new Set(rows.map((row) => row.bucket))].map((bucket) => [
      bucket,
      rows.filter((row) => row.bucket === bucket).length,
    ]),
  ),
  units: Object.fromEntries(
    [...new Set(direct.map((row) => row.unit))].map((unit) => [
      unit,
      direct.filter((row) => row.unit === unit).length,
    ]),
  ),
  componentFilesWithDirectSizes: new Set(direct.map((row) => row.component))
    .size,
  tokenDefinitionDeclarations: definitions.length,
  tokenReferences: references.length,
  frameworkScaleUtilities: utilities.length,
  unresolvedReviewCandidates: review.length,
};
writeFileSync(
  path.join(output, "manifest.json"),
  `${JSON.stringify(
    {
      generatedAt: "2026-10-03",
      methodology:
        "Static lexical authoring occurrences; TypeScript AST and PostCSS; raw JSX/style numeric dimensions are implicit px; line-height ratios, SVG stroke units, token definitions, breakpoints and intrinsic assets are separate. rem equivalents assume a 16px root only for recommendations.",
      summary,
      files: manifests,
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  path.join(output, "component-details.md"),
  "# Complete component sizing tables\n\nEach row groups identical size/property authoring occurrences within one component file. Locations are line:column; counts are static source occurrences, not rendered DOM frequency. CSV counterparts retain exact individual locations.\n\n" +
    table(grouped, [
      ["Size", "size"],
      ["Property", "property"],
      ["Component", "component"],
      ["File", "file"],
      ["Locations", "locations"],
      ["Count", "occurrence_count"],
      ["Recommended token", "recommended_token"],
    ]) +
    "\n",
);
writeFileSync(
  path.join(output, "component-summary.md"),
  "# Sizing by component/file\n\nRare means one authoring occurrence of a pixel value in this file, even when that value is common globally. Tailwind scale utilities and CSS token references are reported separately.\n\n" +
    table(componentSummary, [
      ["Component/file", "component"],
      ["Raw px count", "raw_pixel_occurrences"],
      ["Other direct sizing", "other_direct_sizes"],
      ["Token refs", "token_references"],
      ["Framework utility refs", "framework_utilities"],
      ["Most common raw px", "most_common"],
      ["Locally rare raw px", "locally_rare"],
    ]) +
    "\n",
);
console.log(
  JSON.stringify({ output: path.relative(root, output), ...summary }, null, 2),
);
