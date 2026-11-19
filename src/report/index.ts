import fs from "node:fs";
import path from "node:path";

import { DEFAULT_REPORT_DIR, resolveResultsDir } from "../core/results";
import type { RunSummary, ToolCounts, ToolResultFile } from "../types";
import { readGit } from "./git";
import { renderReport } from "./html";
import { loadResults } from "./load";

export interface GenerateReportOptions {
  /** Default: $TESTKIT_RESULTS_DIR or ".testkit/results". */
  resultsDir?: string;
  /** Default: ".testkit/report". */
  reportDir?: string;
  /** Page title. Default: "Test report". */
  title?: string;
  cwd?: string;
  /** Tools you expected results for; a missing one shows a notice in the report. */
  expectTools?: string[];
  /**
   * Embed screenshots in index.html so the one file is the whole report (default true).
   * Traces and videos always stay in assets/ next to it. false links images from assets/ instead.
   */
  inline?: boolean;
}

export interface GenerateReportResult {
  reportDir: string;
  indexPath: string;
  summary: RunSummary;
  files: ToolResultFile[];
  warnings: string[];
}

/** Builds the summary from the per-tool files. */
export function summarize(files: ToolResultFile[], cwd = process.cwd()): RunSummary {
  const starts = files.map((f) => Date.parse(f.startedAt)).filter(Number.isFinite);
  const ends = files.map((f) => Date.parse(f.finishedAt)).filter(Number.isFinite);
  const now = Date.now();
  const tools: Record<string, ToolCounts> = {};
  for (const f of files) tools[f.tool] = f.counts;
  return {
    startedAt: new Date(starts.length ? Math.min(...starts) : now).toISOString(),
    finishedAt: new Date(ends.length ? Math.max(...ends) : now).toISOString(),
    git: readGit(cwd),
    tools,
  };
}

/** Reads <resultsDir>/*.json and writes <reportDir>/index.html plus <reportDir>/assets/. All links are relative. */
export function generateReport(options: GenerateReportOptions = {}): GenerateReportResult {
  const cwd = options.cwd ?? process.cwd();
  const resultsDir = resolveResultsDir(options.resultsDir, cwd);
  const reportDir = path.resolve(cwd, options.reportDir ?? DEFAULT_REPORT_DIR);
  const { files, invalid } = loadResults(resultsDir);
  const order = (t: string) => (t === "jest" ? 0 : t === "playwright" ? 1 : 2);
  files.sort((a, b) => order(a.tool) - order(b.tool) || a.tool.localeCompare(b.tool));

  const warnings: string[] = [];
  for (const tool of options.expectTools ?? []) {
    if (!files.some((f) => f.tool === tool)) warnings.push(`No ${tool} results in ${path.relative(cwd, resultsDir) || "."} — is the testkit ${tool} reporter configured?`);
  }
  for (const file of invalid) warnings.push(`Skipped ${path.relative(cwd, file)}: not a testkit result file.`);

  fs.rmSync(reportDir, { recursive: true, force: true });
  fs.mkdirSync(reportDir, { recursive: true });
  const inline = options.inline ?? true;
  const assets = path.join(resultsDir, "assets");
  const isImage = (file: string) => /\.(png|jpe?g|webp|gif)$/i.test(file);
  if (fs.existsSync(assets)) {
    // Inline mode embeds images in index.html, so only traces, videos and other files are copied.
    fs.cpSync(assets, path.join(reportDir, "assets"), { recursive: true, filter: (src) => !inline || !isImage(src) });
  }
  const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
  const embed = (a: { path: string; contentType: string }): string | null => {
    if (!inline) return null;
    const file = path.join(resultsDir, a.path);
    if (!fs.existsSync(file)) return null;
    const type = a.contentType.startsWith("image/") ? a.contentType : (MIME[path.extname(file).toLowerCase()] ?? "image/png");
    return `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
  };

  const summary = summarize(files, cwd);
  const html = renderReport({
    title: options.title ?? "Test report",
    summary,
    files,
    warnings,
    embed,
    tracePath: (p) => path.relative(cwd, path.join(reportDir, p)).split(path.sep).join("/"),
  });
  const indexPath = path.join(reportDir, "index.html");
  fs.writeFileSync(indexPath, html);
  return { reportDir, indexPath, summary, files, warnings };
}
