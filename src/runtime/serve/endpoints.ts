/**
 * @file Endpoints utilities derived from ServerSpec (implementation-agnostic).
 */
import type { ServerSpec } from "./schema";

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

/** Extract a sorted list of endpoints from a ServerSpec (plus /health). */
export function extractEndpointsFromSpec(spec: ServerSpec): string[] {
  const eps: string[] = ["GET /health"];
  for (const item of spec.items) {
    if (item.type !== "tool") { continue; }
    const t = item;
    const expose = t.routes;
    if (!expose) { continue; }
    const arr = Array.isArray(expose) ? expose : [expose];
    for (const m of arr) {
      eps.push(`${m.method} ${m.path}`);
    }
  }
  return unique(eps).sort();
}
