import { execFileSync } from "node:child_process";

import type { GitInfo } from "../types";

function git(args: string[], cwd: string): string | null {
  try {
    return execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch {
    return null;
  }
}

/** Branch and short commit — from CI variables first, then the local repository. */
export function readGit(cwd = process.cwd()): GitInfo | undefined {
  const env = process.env;
  const branch = env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || env.CI_COMMIT_REF_NAME || git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const sha = env.GITHUB_SHA || env.CI_COMMIT_SHA || git(["rev-parse", "HEAD"], cwd);
  if (!branch && !sha) return undefined;
  return { branch: branch ?? "", commit: sha ? sha.slice(0, 7) : "" };
}
