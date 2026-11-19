import fs from "node:fs";
import path from "node:path";

import type { TestRecord, ToolCounts, ToolName, ToolResultFile } from "../types";

export const DEFAULT_RESULTS_DIR = ".testkit/results";
export const DEFAULT_REPORT_DIR = ".testkit/report";
/** The CLI sets this so reporters write where the CLI reads. An explicit reporter option still wins. */
export const RESULTS_DIR_ENV = "TESTKIT_RESULTS_DIR";

export function resolveResultsDir(dir?: string, cwd = process.cwd()): string {
  return path.resolve(cwd, dir ?? process.env[RESULTS_DIR_ENV] ?? DEFAULT_RESULTS_DIR);
}

export function countRecords(records: TestRecord[], durationMs: number): ToolCounts {
  const counts: ToolCounts = { total: records.length, passed: 0, failed: 0, skipped: 0, flaky: 0, durationMs };
  for (const r of records) counts[r.status] += 1;
  return counts;
}

export function writeToolResult(
  outputDir: string,
  tool: ToolName,
  startedAt: Date,
  finishedAt: Date,
  records: TestRecord[],
): string {
  const file: ToolResultFile = {
    schemaVersion: 1,
    tool,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    counts: countRecords(records, Math.max(0, finishedAt.getTime() - startedAt.getTime())),
    records,
  };
  fs.mkdirSync(outputDir, { recursive: true });
  const target = path.join(outputDir, `${tool}.json`);
  fs.writeFileSync(target, JSON.stringify(file, null, 2));
  return target;
}

/** Path relative to `from`, always with "/" so it works in URLs and on every OS. */
export function toPosixRelative(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/");
}

// eslint-disable-next-line no-control-regex
const ANSI = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

/** Absolute paths under `root` become relative, so a report from CI reads the same as a local one. */
export function relativizePaths(text: string, root = process.cwd()): string {
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return text.split(prefix).join("").split("file://").join("");
}

/** Splits a failure text into the message part and the full stack. Paths under `root` become relative. */
export function splitError(text: string, root = process.cwd()): { message: string; stack?: string } {
  const clean = relativizePaths(stripAnsi(text), root).replace(/\s+$/, "");
  const at = clean.search(/\n\s+at /);
  if (at === -1) return { message: clean };
  return { message: clean.slice(0, at).trim(), stack: clean };
}
