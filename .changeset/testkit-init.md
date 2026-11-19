---
"@woodylovesboota/test-kit": minor
---

Add `testkit init`: adds the `test:report` scripts and the `.gitignore` entry, and switches `jest.config.*` / `playwright.config.*` to the testkit presets (or creates them). Config files with an unusual shape are left untouched and the lines to add are printed. `--dry-run` shows the changes without writing.
