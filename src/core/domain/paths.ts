/**
 * @file Path helpers (repo-relative POSIX normalization and tree querying).
 */
import { join as joinPath, relative as relPath, isAbsolute } from "node:path";
import type { KnowledgeGraphStore } from "../../services/knowledge-graph/graph";

/** Convert any path separators to POSIX forward slashes. */
export function toPosix(p: string): string {
  return String(p).replace(/\\/g, "/");
}

/** Join repoDir and rel path, returning an absolute path (POSIX not guaranteed). */
export function joinRepo(repoDir: string, rel: string): string {
  const base = String(repoDir);
  const r = String(rel);
  if (isAbsolute(r)) {
    return r;
  }
  return joinPath(base, r);
}

/** Get repo-relative POSIX path from absolute path. */
export function relFromRepo(repoDir: string, absPath: string): string {
  return toPosix(relPath(repoDir, absPath));
}

/** Return true if path is under base directory (both POSIX). */
export function isUnderDir(path: string, base: string): boolean {
  if (!base || base.length === 0) {
    return true;
  }
  const p = toPosix(path);
  const b = toPosix(base);
  return p.startsWith(b);
}

/** Strip a leading base prefix from path, returning the remainder. */
export function stripPrefix(path: string, base: string): string {
  const p = toPosix(path);
  const b = toPosix(base);
  if (b && p.startsWith(b)) {
    return p.slice(b.length);
  }
  return p;
}

/**
 * List immediate children (dirs/files) under a base path by scanning File nodes in the graph.
 */
export function listImmediateChildren(g: KnowledgeGraphStore, base: string): { dirs: string[]; files: string[] } {
  const basePosix = toPosix(base);
  const dirs = new Set<string>();
  const files: string[] = [];
  for (const n of g.nodes.values()) {
    if (n.type !== "File") {
      continue;
    }
    const p = typeof n.props.path === "string" ? toPosix(n.props.path as string) : "";
    if (!p) {
      continue;
    }
    if (basePosix) {
      if (!p.startsWith(basePosix)) {
        continue;
      }
    }
    const rest = basePosix ? p.slice(basePosix.length) : p;
    if (!rest) {
      continue;
    }
    const parts = rest.split("/");
    const seg = parts[0] ? parts[0] : rest;
    const hasMore = parts.length > 1;
    if (hasMore) {
      dirs.add(seg);
    } else {
      files.push(rest);
    }
  }
  return { dirs: Array.from(dirs).sort(), files: files.sort() };
}
