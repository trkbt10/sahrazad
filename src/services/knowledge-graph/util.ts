/**
 * @file Small, shared utilities for knowledge graph.
 */
import path from "node:path";

/** Sleep helper for polling/backoff scenarios. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Repo-relative POSIX path helper, normalizing Windows separators. */
export function rel(repoDir: string, p: string) {
  return path.relative(repoDir, p).replace(/\\/g, "/");
}
