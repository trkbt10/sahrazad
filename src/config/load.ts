/**
 * @file Load config (shrzad.config.json) and merge with CLI args (config-first).
 */
import { readFileSync, existsSync } from "node:fs";
import { join as joinPath } from "node:path";
import Ajv from "ajv";
import type { AppConfig } from "./schema";
import { AppConfigSchema } from "./schema";

const ajv = new Ajv({ useDefaults: true, allErrors: true });
const validate = ajv.compile(AppConfigSchema);

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
  if (!validate(data)) {
    const msg = ajv.errorsText(validate.errors ?? []);
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
