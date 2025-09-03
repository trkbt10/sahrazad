/**
 * @file Parse argv using node:util parseArgs according to ArgSpec.
 */
import { parseArgs } from "node:util";
import type { ArgSpec, ParsedArgs, ArgType, FromArgSpec } from "./types";

function toOptionType(t: ArgType): { type: "string" | "boolean"; multiple?: boolean } {
  if (t === "string[]") {
    return { type: "string", multiple: true } as const;
  }
  if (t === "boolean") {
    // Parse boolean as string to allow explicit values like "--flag false" across shells.
    return { type: "string" } as const;
  }
  return { type: "string" } as const; // string/number handled post-parse
}

/** Build parseArgs options from ArgSpec (flags only). */
function buildParseOptions(spec: ArgSpec) {
  const options: Record<string, { type: "string" | "boolean"; multiple?: boolean }> = {};
  for (const [k, v] of Object.entries(spec)) {
    const opt = toOptionType(v.type);
    options[k] = { ...opt } as { type: "string" | "boolean"; multiple?: boolean };
  }
  return { options } as const;
}

/** Parse argv (without node/script) e.g., ["--text","hello","--topK","5"]. */
export function parseArgv<S extends ArgSpec>(argv: string[], spec: S): FromArgSpec<S> {
  const parsed = parseArgs({ args: argv, allowPositionals: false, ...buildParseOptions(spec) });
  // Coerce types per spec
  const out: ParsedArgs = {};
  for (const [k, rule] of Object.entries(spec)) {
    const v = (parsed.values as Record<string, unknown>)[k];
    if (rule.type === "string") {
      out[k] = typeof v === "string" ? v : (typeof rule.default === "string" ? rule.default : "");
      continue;
    }
    if (rule.type === "number") {
      if (typeof v === "number") {
        out[k] = v;
      } else if (typeof v === "string") {
        const n = Number(v);
        out[k] = Number.isFinite(n) ? n : (typeof rule.default === "number" ? rule.default : 0);
      } else {
        out[k] = typeof rule.default === "number" ? rule.default : 0;
      }
      continue;
    }
    if (rule.type === "boolean") {
      if (typeof v === "boolean") {
        out[k] = v;
        continue;
      }
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1" || s === "yes" || s === "y") {
          out[k] = true;
        } else if (s === "false" || s === "0" || s === "no" || s === "n") {
          out[k] = false;
        } else {
          out[k] = typeof rule.default === "boolean" ? rule.default : false;
        }
        continue;
      }
      out[k] = typeof rule.default === "boolean" ? rule.default : false;
      continue;
    }
    if (rule.type === "string[]") {
      if (Array.isArray(v)) {
        const arr = (v as unknown[]).filter((x): x is string => typeof x === "string");
        out[k] = arr;
      } else if (typeof v === "string") {
        out[k] = [v];
      } else if (Array.isArray(rule.default)) {
        const arr = (rule.default as unknown[]).filter((x): x is string => typeof x === "string");
        out[k] = arr;
      } else {
        out[k] = [];
      }
      continue;
    }
  }
  return out as FromArgSpec<S>;
}
