// Jest reporter: turns the aggregated result into TestRecords and writes <outputDir>/jest.json.
// Uses structural types only, so the package has no runtime or type dependency on Jest internals.
import { resolveResultsDir, splitError, stripAnsi, toPosixRelative, writeToolResult } from "../core/results";
import type { TestRecord, TestStatus } from "../types";

export interface JestReporterOptions {
  /** Where jest.json goes. Default: $TESTKIT_RESULTS_DIR or ".testkit/results". */
  outputDir?: string;
}

interface AssertionLike {
  ancestorTitles: string[];
  title: string;
  fullName: string;
  status: string;
  duration?: number | null;
  failureMessages: string[];
  retryReasons?: string[];
}

interface FileResultLike {
  testFilePath: string;
  testResults: AssertionLike[];
  testExecError?: { message?: string; stack?: string } | null;
  failureMessage?: string | null;
}

interface AggregatedResultLike {
  startTime: number;
  testResults: FileResultLike[];
}

interface GlobalConfigLike {
  rootDir: string;
}

function statusOf(a: AssertionLike, retries: number): TestStatus {
  if (a.status === "passed") return retries > 0 ? "flaky" : "passed";
  if (a.status === "failed") return "failed";
  return "skipped"; // pending, todo, skipped, disabled
}

export default class TestkitJestReporter {
  private readonly outputDir: string;
  private readonly rootDir: string;

  constructor(globalConfig: GlobalConfigLike, options: JestReporterOptions = {}) {
    this.rootDir = globalConfig?.rootDir ?? process.cwd();
    this.outputDir = resolveResultsDir(options.outputDir);
  }

  onRunComplete(_contexts: unknown, results: AggregatedResultLike): void {
    const records: TestRecord[] = [];
    for (const fileResult of results.testResults) {
      const file = toPosixRelative(this.rootDir, fileResult.testFilePath);
      fileResult.testResults.forEach((a, i) => {
        const retries = a.retryReasons?.length ?? 0;
        const status = statusOf(a, retries);
        records.push({
          id: `jest:${file}:${i}`,
          tool: "jest",
          file,
          suite: a.ancestorTitles.join(" › "),
          title: a.title,
          status,
          durationMs: a.duration ?? 0,
          retries,
          error: status === "failed" && a.failureMessages.length ? splitError(a.failureMessages.join("\n\n"), this.rootDir) : undefined,
          attachments: [],
        });
      });
      // A file that could not run (syntax error, failing import) has no test entries — keep it visible.
      if (fileResult.testExecError && fileResult.testResults.length === 0) {
        const text = fileResult.failureMessage ?? fileResult.testExecError.stack ?? fileResult.testExecError.message ?? "";
        records.push({
          id: `jest:${file}:exec`,
          tool: "jest",
          file,
          suite: "",
          title: "Test file failed to run",
          status: "failed",
          durationMs: 0,
          retries: 0,
          error: splitError(stripAnsi(text), this.rootDir),
          attachments: [],
        });
      }
    }
    writeToolResult(this.outputDir, "jest", new Date(results.startTime), new Date(), records);
  }

  getLastError(): Error | undefined {
    return undefined;
  }
}

export { TestkitJestReporter };
