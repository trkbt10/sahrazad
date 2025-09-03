/**
 * @file Parse plain object args (e.g., JSON payload) according to ArgSpec.
 */
import type { ArgSpec, ParsedArgs, FromArgSpec } from "./types";

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) { return v; }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) { return n; }
  }
  return undefined;
}

function toBoolean(v: unknown): boolean | undefined {
  if (typeof v === "boolean") { return v; }
  if (typeof v === "string") {
    const s = v.toLowerCase();
    if (s === "true") { return true; }
    if (s === "false") { return false; }
  }
  return undefined;
}

function toStringArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) {
    const out = (v as unknown[]).filter((x): x is string => typeof x === "string");
    return out;
  }
  if (typeof v === "string") {
    return [v];
  }
  return undefined;
}

/** Parse a plain object by schema with simple coercions (number/boolean/string[]). */
export function parseObjectArgs<S extends ArgSpec>(input: Record<string, unknown>, spec: S): FromArgSpec<S> {
  const out: ParsedArgs = {};
  const keys = Object.keys(spec);
  for (const k of keys) {
    const rule = spec[k]!;
    const value = input[k];
    if (rule.type === "string") {
      if (typeof value === "string") {
        out[k] = value;
        continue;
      }
      if (typeof rule.default === "string") {
        out[k] = rule.default;
      }
      continue;
    }
    if (rule.type === "number") {
      const n = toNumber(value);
      if (n !== undefined) {
        out[k] = n;
        continue;
      }
      const dv = toNumber(rule.default);
      if (dv !== undefined) {
        out[k] = dv;
      }
      continue;
    }
    if (rule.type === "boolean") {
      const b = toBoolean(value);
      if (b !== undefined) {
        out[k] = b;
        continue;
      }
      const db = toBoolean(rule.default);
      if (db !== undefined) {
        out[k] = db;
      }
      continue;
    }
    if (rule.type === "string[]") {
      const arr = toStringArray(value) ?? toStringArray(rule.default);
      if (arr !== undefined) {
        out[k] = arr;
      }
      continue;
    }
  }
  return out as FromArgSpec<S>;
}
