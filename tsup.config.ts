import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
    "presets/jest": "src/presets/jest.ts",
    "presets/playwright": "src/presets/playwright.ts",
    "reporters/jest": "src/reporters/jest.ts",
    "reporters/playwright": "src/reporters/playwright.ts",
    "helpers/playwright": "src/helpers/playwright.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  // One self-contained file per entry: presets locate the reporter files next to themselves via __dirname.
  splitting: false,
  shims: true,
  clean: true,
  target: "node18",
  platform: "node",
  external: ["jest", "@playwright/test"],
});
