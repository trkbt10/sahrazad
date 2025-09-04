/**
 * @file Shared validators for core configuration and adapters.
 */
import type { CoreIngestConfig } from "./types";

/** Ensure provided value is a function. */
function isFn(x: unknown): x is (...args: unknown[]) => unknown {
  return typeof x === "function";
}

/**
 * Validate the vector client minimal surface we rely on across core (upsert/findMany).
 * Throws with clear messages when required functions are missing.
 */
export function validateVectorClient(client: unknown): void {
  const o = client as { upsert?: unknown; findMany?: unknown } | null;
  if (!o) { throw new Error("vector.client is required"); }
  if (!isFn(o.upsert)) { throw new Error("vector.client.upsert is required"); }
  if (!isFn(o.findMany)) { throw new Error("vector.client.findMany is required"); }
  // index.saveState existence is best-effort
}

/**
 * Validate a CoreIngestConfig at startup.
 * Checks required structural fields and the vector client surface.
 */
export function validateIngestConfig(config: CoreIngestConfig): void {
  if (!config) { throw new Error("config is required"); }
  if (!config.engine) { throw new Error("config.engine is required"); }
  if (!config.embed) { throw new Error("config.embed is required"); }
  if (!config.repoDir) { throw new Error("config.repoDir is required"); }
  if (!config.projectRoot) { throw new Error("config.projectRoot is required"); }
  if (!config.kgfSpec) { throw new Error("config.kgfSpec is required"); }
  if (!config.vector || !config.vector.client) { throw new Error("config.vector.client is required"); }
  validateVectorClient(config.vector.client);
}
