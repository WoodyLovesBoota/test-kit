#!/usr/bin/env node
// testkit run [--only jest|playwright] [--open]   run the tools one after another, then build the report
// testkit report [--open]                         rebuild the report from saved results
// testkit init [--dry-run]                         add scripts, .gitignore entry and presets to this project
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { DEFAULT_REPORT_DIR, DEFAULT_RESULTS_DIR, RESULTS_DIR_ENV } from "./core/results";
import { printInit, runInit } from "./init";
import { generateReport } from "./report";

type Tool = "jest" | "playwright";
const TOOLS: Tool[] = ["jest", "playwright"];

export interface TestkitConfig {
  resultsDir?: string;
  reportDir?: string;
  title?: string;
  /** Which tools `testkit run` runs. Default: the ones installed in the project. */
  tools?: Tool[];
  /** Embed screenshots in index.html (default true). */
  inline?: boolean;
  /** Shell command per tool. Default: "<pm> exec jest" / "<pm> exec playwright test". */
  commands?: Partial<Record<Tool, string>>;
}

const HELP = `Usage:
  testkit init [--dry-run]
  testkit run [--only jest|playwright] [--open]
  testkit report [--open]

Commands:
  init                 Add the test:report scripts, ignore .testkit/, and switch jest.config /
                       playwright.config to the testkit presets (or create them)
  run                  Run Jest, then Playwright, then build the report
  report               Rebuild the report from saved results

Options:
  --only <tool>        Run one tool only (run)
  --open               Open the report in a browser when done
  --results <dir>      Results directory (default ${DEFAULT_RESULTS_DIR})
  --report <dir>       Report directory (default ${DEFAULT_REPORT_DIR})
  --no-inline          Link screenshots from assets/ instead of embedding them in index.html
  --dry-run            Show what init would change without writing (init)
  --jest-cmd <cmd>     Command that runs Jest
  --playwright-cmd <cmd>  Command that runs Playwright
  -h, --help           Show this help

Config: "testkit" field in package.json, or testkit.config.json (same keys:
resultsDir, reportDir, title, tools, commands.jest, commands.playwright).`;

interface Args {
  command?: string;
  only?: Tool;
  open: boolean;
  results?: string;
  report?: string;
  jestCmd?: string;
  playwrightCmd?: string;
  inline?: boolean;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { open: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.startsWith("--") && a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
    const value = () => inline ?? argv[++i];
    switch (flag) {
      case "--only": {
        const v = value();
        if (v !== "jest" && v !== "playwright") fail(`--only must be "jest" or "playwright" (got "${v}")`);
        args.only = v as Tool;
        break;
      }
      case "--open":
        args.open = true;
        break;
      case "--no-inline":
        args.inline = false;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--results":
        args.results = value();
        break;
      case "--report":
        args.report = value();
        break;
      case "--jest-cmd":
        args.jestCmd = value();
        break;
      case "--playwright-cmd":
        args.playwrightCmd = value();
        break;
      case "-h":
      case "--help":
        args.help = true;
        break;
      default:
        if (a.startsWith("-")) fail(`Unknown option ${a}`);
        if (!args.command) args.command = a;
        else fail(`Unexpected argument ${a}`);
    }
  }
  return args;
}

function fail(message: string): never {
  console.error(`testkit: ${message}\n\n${HELP}`);
  process.exit(2);
}

function readConfig(cwd: string): TestkitConfig {
  const file = path.join(cwd, "testkit.config.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as TestkitConfig;
  const pkg = path.join(cwd, "package.json");
  if (fs.existsSync(pkg)) return ((JSON.parse(fs.readFileSync(pkg, "utf8")) as { testkit?: TestkitConfig }).testkit ?? {}) as TestkitConfig;
  return {};
}

function packageManagerExec(cwd: string): string {
  let dir = cwd;
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm exec";
    if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
    if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) return "bunx";
    if (fs.existsSync(path.join(dir, "package-lock.json"))) return "npx";
    const up = path.dirname(dir);
    if (up === dir) return "npx";
    dir = up;
  }
}

function installed(name: string, cwd: string): boolean {
  try {
    createRequire(path.join(cwd, "package.json")).resolve(`${name}/package.json`);
    return true;
  } catch {
    return false;
  }
}

function title(cwd: string, config: TestkitConfig): string {
  if (config.title) return config.title;
  try {
    const name = (JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")) as { name?: string }).name;
    return name ? `${name} — test report` : "Test report";
  } catch {
    return "Test report";
  }
}

function openInBrowser(file: string): void {
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [file]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : ["xdg-open", [file]];
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => console.error(`testkit: could not open a browser. Open ${file} yourself.`));
  child.unref();
}

function report(cwd: string, config: TestkitConfig, args: Args, expectTools: string[]) {
  const result = generateReport({
    cwd,
    resultsDir: args.results ?? config.resultsDir,
    reportDir: args.report ?? config.reportDir,
    title: title(cwd, config),
    expectTools,
    inline: args.inline ?? config.inline ?? true,
  });
  for (const w of result.warnings) console.warn(`testkit: ${w}`);
  const failed = result.files.reduce((n, f) => n + f.counts.failed, 0);
  const total = result.files.reduce((n, f) => n + f.counts.total, 0);
  console.log(`\ntestkit: report ${path.relative(cwd, result.indexPath)} (${total} tests, ${failed} failed)`);
  if (args.open) openInBrowser(result.indexPath);
  return { failed, result };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command) {
    console.log(HELP);
    process.exit(args.help ? 0 : 2);
  }
  const cwd = process.cwd();
  const config = readConfig(cwd);
  const resultsDir = path.resolve(cwd, args.results ?? config.resultsDir ?? process.env[RESULTS_DIR_ENV] ?? DEFAULT_RESULTS_DIR);

  if (args.command === "init") {
    const exec = packageManagerExec(cwd);
    const run = exec === "pnpm exec" ? "pnpm test:report" : exec === "yarn" ? "yarn test:report" : exec === "bunx" ? "bun run test:report" : "npm run test:report";
    try {
      printInit(runInit({ cwd, dryRun: args.dryRun }), args.dryRun, run);
    } catch (e) {
      fail((e as Error).message);
    }
    return;
  }

  if (args.command === "report") {
    report(cwd, config, args, []);
    return;
  }
  if (args.command !== "run") fail(`Unknown command "${args.command}"`);

  const exec = packageManagerExec(cwd);
  const commands: Record<Tool, string> = {
    jest: args.jestCmd ?? config.commands?.jest ?? `${exec} jest`,
    playwright: args.playwrightCmd ?? config.commands?.playwright ?? `${exec} playwright test`,
  };
  const tools = args.only ? [args.only] : (config.tools ?? TOOLS.filter((t) => installed(t === "jest" ? "jest" : "@playwright/test", cwd)));
  if (!tools.length) fail("Neither jest nor @playwright/test is installed here. Set `tools` in the testkit config.");

  let commandFailed = false;
  for (const tool of tools) {
    fs.rmSync(path.join(resultsDir, `${tool}.json`), { force: true });
    console.log(`\ntestkit: ${tool} → ${commands[tool]}\n`);
    const res = spawnSync(commands[tool], {
      cwd,
      shell: true,
      stdio: "inherit",
      env: { ...process.env, [RESULTS_DIR_ENV]: resultsDir },
    });
    if (res.status !== 0) {
      commandFailed = true;
      console.error(`testkit: ${tool} exited with ${res.status ?? res.signal}`);
    }
  }
  const { failed } = report(cwd, config, { ...args, results: resultsDir }, tools);
  process.exit(commandFailed || failed > 0 ? 1 : 0);
}

main();
