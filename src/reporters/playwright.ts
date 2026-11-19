// Playwright reporter: one TestRecord per test (final attempt), with every attachment that has a file
// or a body (automatic screenshots, test.info().attach() step screenshots, traces, videos) copied to
// <outputDir>/assets/playwright/. Writes <outputDir>/playwright.json.
import fs from "node:fs";
import path from "node:path";

import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from "@playwright/test/reporter";

import { relativizePaths, resolveResultsDir, splitError, stripAnsi, toPosixRelative, writeToolResult } from "../core/results";
import type { TestAttachment, TestRecord, TestStatus } from "../types";

export interface PlaywrightReporterOptions {
  /** Where playwright.json and assets/ go. Default: $TESTKIT_RESULTS_DIR or ".testkit/results". */
  outputDir?: string;
}

const ASSET_SUBDIR = "assets/playwright";

const EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "video/webm": ".webm",
  "application/zip": ".zip",
  "text/plain": ".txt",
  "application/json": ".json",
  "text/html": ".html",
};

function slug(text: string): string {
  return (
    text
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "file"
  );
}

interface Latest {
  test: TestCase;
  result: TestResult;
  attachments: TestAttachment[];
  copied: string[];
}

export default class TestkitPlaywrightReporter implements Reporter {
  private readonly outputDir: string;
  private readonly assetDir: string;
  private readonly latest = new Map<string, Latest>();
  private rootSuite?: Suite;
  private startedAt = new Date();
  private seq = 0;

  constructor(options: PlaywrightReporterOptions = {}) {
    this.outputDir = resolveResultsDir(options.outputDir);
    this.assetDir = path.join(this.outputDir, ASSET_SUBDIR);
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.rootSuite = suite;
    this.startedAt = new Date();
    fs.rmSync(this.assetDir, { recursive: true, force: true });
    fs.mkdirSync(this.assetDir, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // A retry replaces the earlier attempt; drop the files copied for it.
    const prev = this.latest.get(test.id);
    for (const file of prev?.copied ?? []) fs.rmSync(file, { force: true });

    const copied: string[] = [];
    const attachments: TestAttachment[] = [];
    const base = `${slug(test.title)}-${(++this.seq).toString(36)}`;
    result.attachments.forEach((a, i) => {
      const ext = (a.path && path.extname(a.path)) || EXT[a.contentType] || "";
      const target = path.join(this.assetDir, `${base}-${i}-${slug(a.name)}${ext}`);
      try {
        if (a.path && fs.existsSync(a.path)) fs.copyFileSync(a.path, target);
        else if (a.body) fs.writeFileSync(target, new Uint8Array(a.body));
        else return;
      } catch {
        return;
      }
      copied.push(target);
      attachments.push({ name: a.name, path: toPosixRelative(this.outputDir, target), contentType: a.contentType });
    });
    this.latest.set(test.id, { test, result, attachments, copied });
  }

  onEnd(result: FullResult): void {
    const records: TestRecord[] = [];
    const seen = new Set<string>();
    for (const { test, result: r, attachments } of this.latest.values()) {
      seen.add(test.id);
      records.push(this.toRecord(test, r, attachments));
    }
    // Tests that never ran (max failures reached, interrupted run) still show up, as skipped.
    for (const test of this.rootSuite?.allTests() ?? []) {
      if (!seen.has(test.id)) records.push(this.toRecord(test, undefined, []));
    }
    const finishedAt = new Date(result.startTime.getTime() + result.duration);
    writeToolResult(this.outputDir, "playwright", result.startTime ?? this.startedAt, finishedAt, records);
  }

  private toRecord(test: TestCase, result: TestResult | undefined, attachments: TestAttachment[]): TestRecord {
    // titlePath: ["", project, file, ...describe, title]
    const titles = test.titlePath();
    const project = test.parent.project()?.name || undefined;
    const file = toPosixRelative(process.cwd(), test.location.file);
    const status = result ? statusOf(test) : "skipped";
    const errors = result?.errors ?? [];
    let error: TestRecord["error"];
    if (status === "failed" && errors.length) {
      const message = errors.map((e) => stripAnsi(e.message ?? e.value ?? "")).join("\n\n");
      const stack = errors.map((e) => relativizePaths(stripAnsi(e.stack ?? ""))).filter(Boolean).join("\n\n");
      error = { message: splitError(message).message, stack: stack || undefined };
    }
    return {
      id: `playwright:${test.id}`,
      tool: "playwright",
      file,
      suite: titles.slice(3, -1).join(" › "),
      title: test.title,
      status,
      durationMs: result?.duration ?? 0,
      retries: result?.retry ?? 0,
      error,
      attachments,
      project,
    };
  }
}

function statusOf(test: TestCase): TestStatus {
  switch (test.outcome()) {
    case "expected":
      return "passed";
    case "flaky":
      return "flaky";
    case "skipped":
      return "skipped";
    default:
      return "failed";
  }
}

export { TestkitPlaywrightReporter };
