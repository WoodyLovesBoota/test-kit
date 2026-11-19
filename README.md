# @woodylovesboota/test-kit

Presets, reporters, and a CLI that put the results of **Jest** and **Playwright** into one HTML report. The report works offline. Use either tool on its own or both together.

The report is one HTML page with two screens. Both use the normal page scroll and have no inner scroll boxes.

- **List**: the scores (passed, failed, flaky, skipped), the duration, run time, git branch and commit, then every test grouped by tool and file, with failures first. A filter bar with search, status and tool stays at the top while you scroll.
- **Detail**: click a test to open its own screen. It shows:
  - the path, status, project and duration;
  - the error in full, with the stack trace one click away;
  - the screenshots, one large image at a time with numbered step thumbnails. Use ← → to move between steps, and click the image to see it full size. A failed test opens on its last screenshot.
  - a trace command you can copy, and a video if one was recorded.
- In the detail screen, **Prev / Next** (or j / k) step through the list as it is currently filtered, and **All tests** (or Esc) goes back to the same scroll position.
- Each test has its own address (`#/t/<id>`), so the browser's back button and links to a test both work.
- The page is light theme only, works at phone widths, and uses system fonts.

**One file.** Screenshots are embedded in `index.html`, so you can send that one file and it opens offline. Traces and videos are too big to embed. They stay in `assets/` next to the file, and the trace command points there. Use `--no-inline` to link screenshots from `assets/` instead, which gives a smaller HTML file for GitHub Pages. Every link is relative and nothing is loaded from a CDN.

## Install

```bash
pnpm add -D @woodylovesboota/test-kit
# peer dependencies — install the ones you use
pnpm add -D jest @playwright/test
```

`jest` (>= 29) and `@playwright/test` (>= 1.40) are optional peer dependencies.

## Setup

```ts
// jest.config.ts
import { createJestConfig } from "@woodylovesboota/test-kit/jest";
export default createJestConfig({ testEnvironment: "jsdom" });
```

```ts
// playwright.config.ts
import { definePlaywrightConfig } from "@woodylovesboota/test-kit/playwright";
export default definePlaywrightConfig({ use: { baseURL: "http://localhost:3000" } });
```

```jsonc
// package.json
{
  "scripts": {
    "test:report": "testkit run",
    "test:report:open": "testkit report --open"
  }
}
```

Add `.testkit/` to `.gitignore`.

### With other config wrappers

The presets return plain config objects, so you can nest them in other wrappers. For example, with Next.js:

```ts
import nextJest from "next/jest.js";
import { createJestConfig as withTestkit } from "@woodylovesboota/test-kit/jest";

export default nextJest({ dir: "./" })(withTestkit({ testEnvironment: "jsdom" }));
```

### Without the presets

Add the reporters yourself:

```js
// jest.config.js
module.exports = { reporters: ["default", ["@woodylovesboota/test-kit/reporters/jest", { outputDir: ".testkit/results" }]] };
```

```ts
// playwright.config.ts
export default defineConfig({ reporter: [["list"], ["@woodylovesboota/test-kit/reporters/playwright"]] });
```

## Step screenshots

```ts
import { test } from "@playwright/test";
import { snap } from "@woodylovesboota/test-kit/helpers";

test("checkout", async ({ page }) => {
  await page.goto("/cart");
  await snap(page, "cart");
  await page.getByRole("button", { name: "Pay" }).click();
  await snap(page, "paid", { mask: [page.getByTestId("clock")] });
});
```

`snap()` does the same as `test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" })`. Screenshots you attach by hand show up in the report too.

## CLI

```
testkit run [--only jest|playwright] [--open]
testkit report [--open]
```

- `testkit run` runs Jest and then Playwright. If one fails, the other still runs. It then builds the report and exits with 1 if any command or test failed.
- `testkit report` rebuilds the report from the saved results.

| Flag | Command | Meaning |
|---|---|---|
| `--only <tool>` | run | Run only `jest` or `playwright` |
| `--open` | run, report | Open the report in the default browser |
| `--results <dir>` | run, report | Results directory (default `.testkit/results`) |
| `--report <dir>` | run, report | Report directory (default `.testkit/report`) |
| `--no-inline` | run, report | Link screenshots from `assets/` instead of embedding them |
| `--jest-cmd <cmd>` | run | Command that runs Jest |
| `--playwright-cmd <cmd>` | run | Command that runs Playwright |

### Config

You can put config in a `"testkit"` field in `package.json` or in a `testkit.config.json` file. CLI flags win over config.

| Key | Default | Meaning |
|---|---|---|
| `resultsDir` | `.testkit/results` | Where the reporters write and `report` reads |
| `reportDir` | `.testkit/report` | Output folder (`index.html` + `assets/`) |
| `title` | `<package name> — test report` | Page title |
| `inline` | `true` | Embed screenshots in `index.html` |
| `tools` | installed ones | Which tools `run` runs, e.g. `["jest"]` |
| `commands.jest` | `<pm> jest` | e.g. `"pnpm exec jest --ci"` |
| `commands.playwright` | `<pm> playwright test` | e.g. `"npx playwright test --project=chromium"` |

`<pm>` comes from the lockfile: `pnpm exec`, `yarn`, `bunx` or `npx`. `testkit run` passes `TESTKIT_RESULTS_DIR` to both commands, so the reporters write where the report reads.

## Options

### `createJestConfig(overrides, options)`

| | Default | Notes |
|---|---|---|
| `testPathIgnorePatterns` | `["/node_modules/", "<rootDir>/e2e/"]` | Keeps Playwright specs out of Jest |
| `modulePathIgnorePatterns` | `["<rootDir>/.testkit/"]` | |
| `reporters` | yours, or `["default"]`, + testkit | Yours are never removed |
| `options.outputDir` | `$TESTKIT_RESULTS_DIR` or `.testkit/results` | Where `jest.json` goes |

### `definePlaywrightConfig(overrides, options)`

| | Default | Notes |
|---|---|---|
| `testDir` | `"e2e"` | |
| `use.screenshot` | `"on"` | One screenshot at the end of every test |
| `use.trace` | `"retain-on-failure"` | |
| `reporter` | yours, or `list` (`dot` on CI), + testkit | Yours are never removed |
| `options.videoOnFailure` | `false` | `true` → `use.video = "retain-on-failure"` |
| `options.outputDir` | `$TESTKIT_RESULTS_DIR` or `.testkit/results` | Where `playwright.json` and `assets/` go |

Your values always win. Plain objects merge deeply. Arrays such as `projects` or `testPathIgnorePatterns` replace the default instead of being merged.

### Reporter options

| Reporter | Option | Default |
|---|---|---|
| `@woodylovesboota/test-kit/reporters/jest` | `outputDir` | `$TESTKIT_RESULTS_DIR` or `.testkit/results` |
| `@woodylovesboota/test-kit/reporters/playwright` | `outputDir` | `$TESTKIT_RESULTS_DIR` or `.testkit/results` |

The Playwright reporter copies every attachment that has a file or a body into `<outputDir>/assets/playwright/`. That includes automatic screenshots, `attach()` and `snap()` screenshots, traces and videos. It clears that folder when a run starts.

## CI (GitHub Actions)

```yaml
- run: pnpm exec playwright install --with-deps chromium
- run: pnpm test:report
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: test-report
    path: .testkit/report
```

## Result format

Each reporter writes `<resultsDir>/<tool>.json`:

```ts
interface ToolResultFile {
  schemaVersion: 1;
  tool: "jest" | "playwright" | string;
  startedAt: string; finishedAt: string;
  counts: { total; passed; failed; skipped; flaky; durationMs };
  records: TestRecord[];
}
interface TestRecord {
  id: string; tool: string; file: string; suite: string; title: string;
  status: "passed" | "failed" | "skipped" | "flaky";
  durationMs: number; retries: number;
  error?: { message: string; stack?: string };
  attachments: { name: string; path: string; contentType: string }[]; // path is relative to resultsDir
  project?: string;
}
```

The report reads only this format. To support another runner, write a reporter that emits a `ToolResultFile` (for example `vitest.json`), and it gets its own tab. Use `writeToolResult()` from the package root to write it.

## Programmatic API

```ts
import { generateReport } from "@woodylovesboota/test-kit";
const { indexPath, summary } = generateReport({ resultsDir: ".testkit/results", reportDir: "public/tests", inline: true });
```

## Known limits

- The Jest `flaky` status needs `jest.retryTimes()`. Without it, Jest tests are only passed, failed or skipped.
- The report UI is English. Test titles are shown as written.
- Large suites put every test and screenshot into one HTML file. With roughly 60 screenshots it comes to about 5 MB. Use `--no-inline` for big suites.

## Development

```bash
pnpm install
pnpm build          # tsup → dist/ (ESM + CJS + .d.ts)
pnpm typecheck
pnpm changeset      # describe a change
pnpm version-packages  # apply changesets → version + CHANGELOG
pnpm release        # build + npm publish
```

To try a local change in another project before publishing, run `pnpm pack` here and install the tarball there. You can also depend on `file:../test-kit` and reinstall after each build.
