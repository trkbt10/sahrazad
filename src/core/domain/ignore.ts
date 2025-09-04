/**
 * @file Ignore pattern matcher for repo-relative paths.
 * Centralizes matching to keep behavior consistent across indexing and recall.
 */

function normalize(p: string): string {
  const s = String(p);
  return s.replace(/\\/g, "/");
}

/** Return true if repo-relative path matches any ignore pattern. */
export function shouldIgnore(relPath: string, patterns: readonly string[]): boolean {
  const path = normalize(relPath);
  for (const raw of patterns) {
    const pat = normalize(String(raw));
    if (pat.length === 0) {
      continue;
    }
    if (path.startsWith(pat)) {
      return true;
    }
    const withSlash = `/${pat}`;
    if (path.includes(withSlash)) {
      return true;
    }
  }
  return false;
}

/** Return true if repo-relative path matches any include pattern (same semantics as ignore). */
export function shouldInclude(relPath: string, patterns: readonly string[]): boolean {
  if (!patterns || patterns.length === 0) { return true; }
  const path = normalize(relPath);
  for (const raw of patterns) {
    const pat = normalize(String(raw));
    if (pat.length === 0) { continue; }
    if (path.startsWith(pat)) { return true; }
    const withSlash = `/${pat}`;
    if (path.includes(withSlash)) { return true; }
  }
  return false;
}
