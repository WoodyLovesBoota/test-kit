import type { Config } from "jest";

import { builtReporter } from "../core/locate";
import { deepMerge } from "../core/merge";
import type { JestReporterOptions } from "../reporters/jest";

export interface TestkitJestOptions extends JestReporterOptions {}

type ReporterEntry = NonNullable<Config["reporters"]>[number];

/** Absolute path of the testkit Jest reporter (for hand-written configs). */
export const jestReporterPath = builtReporter("jest");

const DEFAULTS: Config = {
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/e2e/"],
  modulePathIgnorePatterns: ["<rootDir>/.testkit/"],
};

function isTestkitReporter(entry: ReporterEntry): boolean {
  const name = typeof entry === "string" ? entry : entry[0];
  return name === jestReporterPath || /test-kit[\\/](dist[\\/])?reporters[\\/]jest/.test(name);
}

/**
 * Jest config with testkit defaults. `overrides` always win (deep merge; arrays are replaced).
 * `reporters` is the exception: yours are kept (default: ["default"]) and the testkit reporter is added.
 */
export function createJestConfig(overrides: Config = {}, options: TestkitJestOptions = {}): Config {
  const merged = deepMerge<Config>(DEFAULTS, overrides);
  const reporters: ReporterEntry[] = [...(overrides.reporters ?? ["default"])];
  if (!reporters.some(isTestkitReporter)) {
    reporters.push([jestReporterPath, { ...(options.outputDir ? { outputDir: options.outputDir } : {}) }]);
  }
  merged.reporters = reporters;
  return merged;
}

export default createJestConfig;
