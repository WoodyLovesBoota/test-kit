# @woodylovesboota/test-kit

## 0.3.0

### Minor Changes

- 4a99dce: Add `testkit init`: adds the `test:report` scripts and the `.gitignore` entry, and switches `jest.config.*` / `playwright.config.*` to the testkit presets (or creates them). Config files with an unusual shape are left untouched and the lines to add are printed. `--dry-run` shows the changes without writing.

## 0.2.0

### Minor Changes

- b734702: First release: Jest and Playwright presets, result reporters, `snap()` helper, and the `testkit` CLI that builds one offline HTML report.
