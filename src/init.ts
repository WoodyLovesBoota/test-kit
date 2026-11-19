// `testkit init`: wires an existing project up to testkit in one go.
//
//   1. package.json  → scripts "test:report" and "test:report:open"
//   2. .gitignore    → /.testkit/
//   3. playwright.config.*  → definePlaywrightConfig(...) instead of defineConfig(...)
//   4. jest.config.*        → export wrapped in createJestConfig(...) (imported as withTestkit)
//
// Config files are only rewritten when they have a common shape. Anything else is left untouched and
// the snippet to add by hand is printed instead. Running it twice changes nothing the second time.
import fs from "node:fs";
import path from "node:path";

import pkg from "../package.json";

const PKG = pkg.name;

export type InitStatus = "created" | "updated" | "unchanged" | "manual" | "skipped";

export interface InitChange {
  file: string;
  status: InitStatus;
  note: string;
  /** For "manual": what to add by hand. */
  snippet?: string;
}

export interface InitOptions {
  cwd?: string;
  /** Report what would change without writing anything. */
  dryRun?: boolean;
}

const SCRIPTS: Record<string, string> = {
  "test:report": "testkit run",
  "test:report:open": "testkit report --open",
};

const CONFIG_EXT = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  jest?: unknown;
  type?: string;
}

function findConfig(cwd: string, base: string): string | null {
  for (const ext of CONFIG_EXT) {
    const file = path.join(cwd, base + ext);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

const isCjs = (file: string, source: string, type?: string) =>
  file.endsWith(".cjs") || (file.endsWith(".js") && type !== "module" && /\bmodule\.exports\s*=/.test(source));

/** Puts `line` after the last top-level import (or `require`), or at the top when there is none. */
function addImport(source: string, line: string): string {
  const re = /^(?:import\s[\s\S]*?\sfrom\s+['"][^'"\n]+['"]|import\s+['"][^'"\n]+['"]|(?:const|let|var)\s[^\n]*=\s*require\(\s*['"][^'"\n]+['"]\s*\)[^\n]*);?[ \t]*$/gm;
  let end = -1;
  for (let m = re.exec(source); m; m = re.exec(source)) end = m.index + m[0].length;
  if (end === -1) {
    // Keep a leading "use strict" or shebang first.
    const head = /^(#![^\n]*\n|(['"])use strict\2;?[ \t]*\n)*/.exec(source)?.[0] ?? "";
    return head + line + "\n" + (head ? "" : "\n") + source.slice(head.length);
  }
  return source.slice(0, end) + "\n" + line + source.slice(end);
}

/** Wraps a trailing `export default { … }` / `module.exports = { … }` object literal in `fn(…)`. */
function wrapTrailingObject(source: string, head: RegExp, fn: string): string | null {
  const m = head.exec(source);
  if (!m) return null;
  const close = /\}\s*;?\s*$/.exec(source);
  if (!close || close.index < m.index) return null;
  return source.slice(0, m.index) + m[0].replace(/\{$/, `${fn}({`) + source.slice(m.index + m[0].length, close.index) + "});\n";
}

/** Drops `name` from `import { … } from "@playwright/test"` when nothing else uses it. */
function dropUnusedNamed(source: string, name: string, from: string): string {
  const uses = source.match(new RegExp(`\\b${name}\\b`, "g"))?.length ?? 0;
  const importRe = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*(['"])${from.replace(/[/.]/g, "\\$&")}\\2;?`);
  const m = importRe.exec(source);
  if (!m) return source;
  const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  if (!names.includes(name) || uses > 1) return source;
  const rest = names.filter((n) => n !== name);
  if (!rest.length) return source.replace(new RegExp(`${importRe.source}[ \\t]*\\n?`), "");
  return source.replace(m[0], `import { ${rest.join(", ")} } from ${m[2]}${from}${m[2]};`);
}

function playwright(file: string, source: string, type?: string): { next: string; note: string } | null {
  if (source.includes(`${PKG}/playwright`)) return null;
  const cjs = isCjs(file, source, type);
  let next: string | null = null;
  let note = "";
  const call = cjs ? /\bmodule\.exports\s*=\s*defineConfig\s*\(/ : /\bexport\s+default\s+defineConfig\s*\(/;
  // export default config;
  const plain = new RegExp(`^(${cjs ? String.raw`module\.exports\s*=\s*` : String.raw`export\s+default\s+`})([\\w$]+)\\s*;?[ \\t]*$`, "m");
  if (call.test(source)) {
    next = source.replace(call, (s) => s.replace(/defineConfig/, "definePlaywrightConfig"));
    note = "defineConfig(…) → definePlaywrightConfig(…)";
  } else if (plain.test(source)) {
    next = source.replace(plain, (_s, l: string, id: string) => `${l}definePlaywrightConfig(${id});`);
    note = "export wrapped in definePlaywrightConfig(…)";
  } else {
    next = wrapTrailingObject(source, cjs ? /\bmodule\.exports\s*=\s*\{/ : /\bexport\s+default\s+\{/, "definePlaywrightConfig");
    note = "config object wrapped in definePlaywrightConfig(…)";
  }
  if (!next) return null;
  next = cjs
    ? addImport(next, `const { definePlaywrightConfig } = require("${PKG}/playwright");`)
    : addImport(dropUnusedNamed(next, "defineConfig", "@playwright/test"), `import { definePlaywrightConfig } from "${PKG}/playwright";`);
  return { next, note };
}

function jest(file: string, source: string, type?: string): { next: string; note: string } | null {
  if (source.includes(`${PKG}/jest`)) return null;
  const cjs = isCjs(file, source, type);
  const lead = cjs ? String.raw`module\.exports\s*=\s*` : String.raw`export\s+default\s+`;
  let next: string | null = null;
  let note = "";
  // export default createJestConfig(config);  (next/jest and other wrappers)
  const wrapped = new RegExp(`^(${lead})([\\w$.]+)\\(\\s*([\\w$]+)\\s*\\)\\s*;?[ \\t]*$`, "m");
  // export default config;
  const plain = new RegExp(`^(${lead})([\\w$]+)\\s*;?[ \\t]*$`, "m");
  if (wrapped.test(source)) {
    next = source.replace(wrapped, (_s, l: string, fn: string, arg: string) => `${l}${fn}(withTestkit(${arg}));`);
    note = "export wrapped: X(config) → X(withTestkit(config))";
  } else if (plain.test(source)) {
    next = source.replace(plain, (_s, l: string, id: string) => `${l}withTestkit(${id});`);
    note = "export wrapped in withTestkit(…)";
  } else {
    next = wrapTrailingObject(source, cjs ? /\bmodule\.exports\s*=\s*\{/ : /\bexport\s+default\s+\{/, "withTestkit");
    note = "config object wrapped in withTestkit(…)";
  }
  if (!next) return null;
  next = addImport(
    next,
    cjs
      ? `const { createJestConfig: withTestkit } = require("${PKG}/jest");`
      : `import { createJestConfig as withTestkit } from "${PKG}/jest";`,
  );
  return { next, note };
}

const NEW_PLAYWRIGHT = `import { definePlaywrightConfig } from "${PKG}/playwright";

// testkit defaults: testDir "e2e", screenshot "on", trace "retain-on-failure", testkit reporter.
export default definePlaywrightConfig({
  // use: { baseURL: "http://localhost:3000" },
  // webServer: { command: "npm run dev", url: "http://localhost:3000" },
});
`;

const NEW_JEST = `import { createJestConfig } from "${PKG}/jest";

// testkit defaults: Playwright's e2e/ folder is ignored, testkit reporter added next to "default".
export default createJestConfig({
  // testEnvironment: "jsdom",
});
`;

export function runInit(options: InitOptions = {}): InitChange[] {
  const cwd = options.cwd ?? process.cwd();
  const write = (file: string, text: string) => {
    if (!options.dryRun) fs.writeFileSync(file, text);
  };
  const out: InitChange[] = [];

  // 1. package.json
  const pkgFile = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgFile)) throw new Error(`No package.json in ${cwd}`);
  const raw = fs.readFileSync(pkgFile, "utf8");
  const json = JSON.parse(raw) as PackageJson;
  const indent = /^\{\n([ \t]+)"/.exec(raw)?.[1] ?? "  ";
  const deps = { ...json.dependencies, ...json.devDependencies };
  const added = Object.keys(SCRIPTS).filter((k) => !json.scripts?.[k]);
  if (added.length) {
    json.scripts = { ...json.scripts };
    for (const k of added) json.scripts[k] = SCRIPTS[k];
    write(pkgFile, JSON.stringify(json, null, indent) + (raw.endsWith("\n") ? "\n" : ""));
    out.push({ file: "package.json", status: "updated", note: `added scripts ${added.join(", ")}` });
  } else out.push({ file: "package.json", status: "unchanged", note: "scripts already there" });

  // 2. .gitignore
  const ignoreFile = path.join(cwd, ".gitignore");
  const ignore = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile, "utf8") : null;
  if (ignore !== null && /^\/?\.testkit\/?[ \t]*$/m.test(ignore)) {
    out.push({ file: ".gitignore", status: "unchanged", note: ".testkit/ already ignored" });
  } else {
    const body = ignore === null ? "" : ignore.replace(/\s*$/, "");
    const text = body ? `${body}\n\n# testkit results and report\n/.testkit/\n` : "/.testkit/\n";
    write(ignoreFile, text);
    out.push({ file: ".gitignore", status: ignore === null ? "created" : "updated", note: "added /.testkit/" });
  }

  // 3–4. configs
  const tools = [
    {
      dep: "@playwright/test",
      base: "playwright.config",
      fresh: NEW_PLAYWRIGHT,
      edit: playwright,
      snippet: `import { definePlaywrightConfig } from "${PKG}/playwright";\nexport default definePlaywrightConfig({ /* your config */ });`,
    },
    {
      dep: "jest",
      base: "jest.config",
      fresh: NEW_JEST,
      edit: jest,
      snippet: `import { createJestConfig as withTestkit } from "${PKG}/jest";\nexport default withTestkit({ /* your config */ });`,
    },
  ];
  for (const t of tools) {
    if (!deps[t.dep]) {
      out.push({ file: `${t.base}.*`, status: "skipped", note: `${t.dep} is not in package.json` });
      continue;
    }
    const file = findConfig(cwd, t.base);
    if (!file) {
      if (t.dep === "jest" && json.jest !== undefined) {
        out.push({ file: "package.json#jest", status: "manual", note: 'Jest is configured in package.json — move it to jest.config.ts, or add the reporter to "jest.reporters"', snippet: `"reporters": ["default", "${PKG}/reporters/jest"]` });
        continue;
      }
      write(path.join(cwd, `${t.base}.ts`), t.fresh);
      out.push({ file: `${t.base}.ts`, status: "created", note: "new config with testkit defaults" });
      continue;
    }
    const name = path.basename(file);
    const source = fs.readFileSync(file, "utf8");
    if (source.includes(`${PKG}/${t.dep === "jest" ? "jest" : "playwright"}`)) {
      out.push({ file: name, status: "unchanged", note: "already uses the testkit preset" });
      continue;
    }
    const result = t.edit(file, source, json.type);
    if (!result) {
      out.push({ file: name, status: "manual", note: "unusual shape — not changed. Wrap your export by hand:", snippet: t.snippet });
      continue;
    }
    write(file, result.next);
    out.push({ file: name, status: "updated", note: result.note });
  }
  return out;
}

const MARK: Record<InitStatus, string> = { created: "+", updated: "~", unchanged: "=", manual: "!", skipped: "-" };

export function printInit(changes: InitChange[], dryRun: boolean, runCmd: string): void {
  const width = Math.max(...changes.map((c) => c.file.length));
  console.log(dryRun ? "\ntestkit init (dry run — nothing written)\n" : "\ntestkit init\n");
  for (const c of changes) {
    console.log(`  ${MARK[c.status]} ${c.file.padEnd(width)}  ${c.status.padEnd(9)} ${c.note}`);
    if (c.snippet) console.log(c.snippet.split("\n").map((l) => `      ${l}`).join("\n"));
  }
  const manual = changes.some((c) => c.status === "manual");
  console.log(`\n${manual ? "Finish the ! items above, then run" : "Next:"} ${runCmd}\n`);
}
