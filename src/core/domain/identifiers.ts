/**
 * @file Common ID helpers for files and symbols in the Knowledge Graph domain.
 * Centralizes `file://` and `symbol://` construction and parsing to avoid ad-hoc strings.
 */

/** Normalize a repo-relative path to POSIX style (forward slashes). */
function normalizeRelPath(p: string): string {
  const s = String(p);
  return s.replace(/\\/g, "/");
}

/** Build a file node ID (file://<repo-relative-path>). */
export function toFileId(relPath: string): string {
  const p = normalizeRelPath(relPath);
  return `file://${p}`;
}

/** Return true if the ID is a file node ID. */
export function isFileId(id: string): boolean {
  if (typeof id !== "string") { return false; }
  return id.startsWith("file://");
}

/** Extract the repo-relative path from a file node ID. */
export function filePathFromId(id: string): string | undefined {
  if (!isFileId(id)) {
    return undefined;
  }
  return id.slice("file://".length);
}

/** Build a symbol node ID (symbol://<kgf-identity>). */
export function toSymbolId(key: string): string {
  const s = String(key);
  return `symbol://${s}`;
}

/** Return true if the ID is a symbol node ID. */
export function isSymbolId(id: string): boolean {
  if (typeof id !== "string") { return false; }
  return id.startsWith("symbol://");
}
