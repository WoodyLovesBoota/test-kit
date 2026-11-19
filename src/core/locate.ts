import fs from "node:fs";
import path from "node:path";

/**
 * Absolute path of a built reporter file. Presets live in dist/presets/, reporters in dist/reporters/.
 * The .cjs build is used because both Jest and Playwright can `require` it from any config format.
 */
export function builtReporter(name: "jest" | "playwright"): string {
  const here = __dirname;
  const candidates = [
    path.join(here, "..", "reporters", `${name}.cjs`),
    path.join(here, "..", "reporters", `${name}.js`),
    path.join(here, "..", "reporters", `${name}.ts`), // running from source (tests, ts-node)
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}
