/**
 * @file Numeric ID registry for stable vector IDs across runs.
 * Uses external FileIO adapter (vcdb) for persistence.
 */
import type { FileIO } from "vcdb/storage/types";

export type IdRegistry = {
  load: () => Promise<void>;
  save: () => Promise<void>;
  idFor: (key: string) => number;
  keyFor: (id: number) => string | undefined;
};

type RegistryJson = { nextId?: number; map?: Record<string, number> };
/**
 * Type guard for persisted registry JSON.
 * Accepts partial objects and validates field shapes without mutating.
 */
function isRegistryJson(v: unknown): v is RegistryJson {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const o = v as Record<string, unknown>;
  const hasNextId = !("nextId" in o) || typeof o.nextId === "number";
  const hasMap = !("map" in o) || typeof o.map === "object";
  if (!hasNextId) { return false; }
  if (!hasMap) { return false; }
  return true;
}

/**
 * Create a persistent numeric ID registry.
 *
 * - Assigns stable incrementing numeric IDs per string key across save/load cycles.
 * - Avoids implicit environment access; the caller provides the file path explicitly.
 */
export function createIdRegistry({ io, path }: { io: FileIO; path: string }): IdRegistry {
  const map = new Map<string, number>();
  const rev = new Map<number, string>();
  const state = { nextId: 1 } as const;

  /** Load registry from disk if present. */
  async function load() {
    try {
      const buf = await io.read(path);
      const raw = JSON.parse(new TextDecoder().decode(buf));
      const j: RegistryJson = isRegistryJson(raw) ? raw : {};
      (state as { nextId: number }).nextId = typeof j.nextId === "number" ? j.nextId : 1;
      const entries = Object.entries(j.map ?? {});
      for (const [k, v] of entries) {
        if (typeof v !== "number") { continue; }
        map.set(k, v);
        rev.set(v, k);
      }
    } catch {
      // Treat as empty when not found or unreadable.
      (state as { nextId: number }).nextId = 1;
    }
  }

  /** Persist registry to disk. */
  async function save() {
    const j = { nextId: state.nextId, map: Object.fromEntries(map) };
    const data = new TextEncoder().encode(JSON.stringify(j, null, 2));
    await io.atomicWrite(path, data);
  }

  /** Get or assign an ID for a string key. */
  function idFor(key: string) {
    const got = map.get(key);
    if (got) { return got; }
    const n = (state as { nextId: number }).nextId++;
    map.set(key, n);
    rev.set(n, key);
    return n;
  }

  /** Resolve the original key for a numeric ID, if any. */
  function keyFor(id: number) {
    return rev.get(id);
  }

  return { load, save, idFor, keyFor };
}
