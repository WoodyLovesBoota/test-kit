// The shared result format. Reporters write it; the report generator reads only this.
// A new runner (e.g. Vitest) needs only a reporter that emits ToolResultFile — the report code stays the same.

export type KnownTool = "jest" | "playwright";
/** Tool name. Known tools get a nicer label in the report; any other string works too. */
export type ToolName = KnownTool | (string & {});

export type TestStatus = "passed" | "failed" | "skipped" | "flaky";

export interface TestAttachment {
  name: string;
  /** Path relative to the results directory (e.g. "assets/playwright/abc-1.png"), always with "/". */
  path: string;
  contentType: string;
}

export interface TestError {
  message: string;
  stack?: string;
}

export interface TestRecord {
  id: string;
  tool: ToolName;
  /** Test file relative to the project root, with "/". */
  file: string;
  /** describe() chain joined with " › ". Empty for top-level tests. */
  suite: string;
  title: string;
  status: TestStatus;
  durationMs: number;
  /** Retries used (0 = passed or failed on the first try). */
  retries: number;
  error?: TestError;
  /** In the order they were attached. */
  attachments: TestAttachment[];
  /** Playwright project name, when there is one. */
  project?: string;
}

export interface ToolCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  durationMs: number;
}

/** One file per tool in the results directory: `<tool>.json`. */
export interface ToolResultFile {
  schemaVersion: 1;
  tool: ToolName;
  startedAt: string;
  finishedAt: string;
  counts: ToolCounts;
  records: TestRecord[];
}

export interface GitInfo {
  branch: string;
  commit: string;
}

export interface RunSummary {
  startedAt: string;
  finishedAt: string;
  git?: GitInfo;
  tools: Partial<Record<KnownTool, ToolCounts>> & Record<string, ToolCounts | undefined>;
}
