import fs from "node:fs";
import path from "node:path";

import type { ToolResultFile } from "../types";

export interface LoadedResults {
  files: ToolResultFile[];
  /** JSON files that could not be read as a ToolResultFile. */
  invalid: string[];
}

/** Reads every `*.json` in the results directory that looks like a ToolResultFile. */
export function loadResults(resultsDir: string): LoadedResults {
  const out: LoadedResults = { files: [], invalid: [] };
  if (!fs.existsSync(resultsDir)) return out;
  for (const name of fs.readdirSync(resultsDir).sort()) {
    if (!name.endsWith(".json")) continue;
    const full = path.join(resultsDir, name);
    try {
      const data = JSON.parse(fs.readFileSync(full, "utf8")) as ToolResultFile;
      if (data && data.schemaVersion === 1 && typeof data.tool === "string" && Array.isArray(data.records)) out.files.push(data);
      else out.invalid.push(full);
    } catch {
      out.invalid.push(full);
    }
  }
  return out;
}
