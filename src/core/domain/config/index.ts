/**
 * @file Cohesive domain config and validators.
 * - App config schema + loader (config-first; CLI overrides via argv)
 * - Core validators for ingest config and vector DB surface
 */
import Ajv from "ajv";
import type { JSONSchemaType } from "ajv";
import { readFileSync, existsSync } from "node:fs";
import { join as joinPath } from "node:path";

// App config schema/types
export type AppConfig = {
  provider?: "xenova" | "openai" | "custom";
  model?: string;
  dir?: string[];
  port?: number;
  restful?: boolean;
  mcp?: boolean;
  basePath?: string;
  dim?: number;
  index?: boolean;
  force?: boolean;
  search?: string;
  k?: number;
  excludes?: string[];
  includes?: string[];
  watchFs?: boolean;
  watchGit?: boolean;
  debounceMs?: number;
  kgf?: string | string[];
  verbose?: boolean;
};

export const AppConfigSchema: JSONSchemaType<AppConfig> = {
  type: "object",
  properties: {
    provider: { type: "string", enum: ["xenova", "openai", "custom"], nullable: true, default: "xenova" },
    model: { type: "string", nullable: true },
    dir: { type: "array", items: { type: "string" }, nullable: true, default: [] },
    port: { type: "number", nullable: true, default: 8787 },
    restful: { type: "boolean", nullable: true, default: true },
    mcp: { type: "boolean", nullable: true, default: false },
    basePath: { type: "string", nullable: true, default: "/api" },
    dim: { type: "number", nullable: true },
    index: { type: "boolean", nullable: true, default: false },
    force: { type: "boolean", nullable: true, default: false },
    search: { type: "string", nullable: true, default: "" },
    k: { type: "number", nullable: true, default: 10 },
    excludes: { type: "array", items: { type: "string" }, nullable: true, default: [".git/", "node_modules/", "dist/", "build/", "coverage/", ".kg/", ".vcdb/"] },
    includes: { type: "array", items: { type: "string" }, nullable: true, default: [] },
    watchFs: { type: "boolean", nullable: true, default: false },
    watchGit: { type: "boolean", nullable: true, default: false },
    debounceMs: { type: "number", nullable: true, default: 200 },
    kgf: { anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }], nullable: true },
    verbose: { type: "boolean", nullable: true, default: false },
  },
  required: [],
  additionalProperties: false,
};

const ajv = new Ajv({ useDefaults: true, allErrors: true });
const validateApp = ajv.compile(AppConfigSchema);

function parseJson(path: string): unknown {
  const text = readFileSync(path, "utf8");
  return JSON.parse(text);
}

/** Compute which CLI keys were provided (e.g., --dir, --model). */
function providedKeysFromArgv(argv: string[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i] ?? "";
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      if (key.length > 0) { set.add(key); }
    }
  }
  return set;
}

/** Load config from file, validate, and apply defaults. */
function loadConfigFile(baseDir: string): AppConfig {
  const p = joinPath(baseDir, "shrzad.config.json");
  if (!existsSync(p)) { return {}; }
  const data = parseJson(p);
  if (!validateApp(data)) {
    const msg = ajv.errorsText(validateApp.errors ?? []);
    throw new Error(`Invalid config: ${msg}`);
  }
  const obj: Record<string, unknown> = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  const cfg: AppConfig = {};
  for (const [k, v] of Object.entries(obj)) {
    (cfg as Record<string, unknown>)[k] = v;
  }
  return cfg;
}

/** Merge config-first with CLI args. CLI only overrides provided keys. */
export function loadEffectiveConfig(baseDir: string, argv: string[], cli: Record<string, unknown>): AppConfig {
  const cfg = loadConfigFile(baseDir);
  const provided = providedKeysFromArgv(argv);
  const out: AppConfig = { ...cfg };
  for (const [k, v] of Object.entries(cli)) {
    if (!provided.has(k)) { continue; }
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// Core validators (moved from src/core/validate/index.ts)
import type { CoreIngestConfig } from "../../types";
import type { VectorDB } from "vcdb";

/** Ensure provided value is a function. */
function isFn(x: unknown): x is (...args: unknown[]) => unknown {
  return typeof x === "function";
}

/**
 * Validate the vector client minimal surface we rely on across core (upsert/findMany).
 * Throws with clear messages when required functions are missing.
 */
export function validateVectorDb(db: unknown): void {
  const o = db as VectorDB<unknown> | null;
  if (!o) {
    throw new Error("vector.db is required");
  }
  if (!isFn(o.upsert)) {
    throw new Error("vector.db.upsert is required");
  }
  if (!isFn(o.findMany)) {
    throw new Error("vector.db.findMany is required");
  }
}

/**
 * Validate a CoreIngestConfig at startup.
 * Checks required structural fields and the vector client surface.
 */
export function validateIngestConfig(config: CoreIngestConfig): void {
  if (!config) {
    throw new Error("config is required");
  }
  if (!config.engine) {
    throw new Error("config.engine is required");
  }
  if (!config.embed) {
    throw new Error("config.embed is required");
  }
  if (!config.repoDir) {
    throw new Error("config.repoDir is required");
  }
  if (!config.projectRoot) {
    throw new Error("config.projectRoot is required");
  }
  if (!config.kgfSpec) {
    throw new Error("config.kgfSpec is required");
  }
  if (!config.vector || !config.vector.db) {
    throw new Error("config.vector.db is required");
  }
  validateVectorDb(config.vector.db);
}

