import type { PlaywrightTestConfig, ReporterDescription } from "@playwright/test";

import { builtReporter } from "../core/locate";
import { deepMerge } from "../core/merge";
import type { PlaywrightReporterOptions } from "../reporters/playwright";

export interface TestkitPlaywrightOptions extends PlaywrightReporterOptions {
  /** Keep a video of failed tests (use.video = "retain-on-failure"). Default false. */
  videoOnFailure?: boolean;
}

/** Absolute path of the testkit Playwright reporter (for hand-written configs). */
export const playwrightReporterPath = builtReporter("playwright");

function toList(reporter: PlaywrightTestConfig["reporter"]): ReporterDescription[] {
  if (reporter === undefined) return [[process.env.CI ? "dot" : "list"]]; // Playwright's own default
  if (typeof reporter === "string") return [[reporter] as ReporterDescription];
  return [...reporter];
}

function isTestkitReporter(entry: ReporterDescription): boolean {
  const name = entry[0];
  return name === playwrightReporterPath || /test-kit[\\/](dist[\\/])?reporters[\\/]playwright/.test(name);
}

/**
 * Playwright config with testkit defaults: testDir "e2e", screenshot "on", trace "retain-on-failure".
 * `overrides` always win (deep merge; arrays such as `projects` are replaced).
 * `reporter` is the exception: yours are kept (default: list, or dot on CI) and the testkit reporter is added.
 */
export function definePlaywrightConfig<T = unknown, W = unknown>(
  overrides: PlaywrightTestConfig<T, W> = {},
  options: TestkitPlaywrightOptions = {},
): PlaywrightTestConfig<T, W> {
  const defaults: PlaywrightTestConfig = {
    testDir: "e2e",
    use: {
      screenshot: "on",
      trace: "retain-on-failure",
      ...(options.videoOnFailure ? { video: "retain-on-failure" as const } : {}),
    },
  };
  const merged = deepMerge(defaults, overrides) as PlaywrightTestConfig<T, W>;
  const reporters = toList(overrides.reporter);
  if (!reporters.some(isTestkitReporter)) {
    reporters.push([playwrightReporterPath, { ...(options.outputDir ? { outputDir: options.outputDir } : {}) }]);
  }
  merged.reporter = reporters;
  return merged;
}

export default definePlaywrightConfig;
