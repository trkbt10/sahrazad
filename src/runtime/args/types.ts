/**
 * @file Types for lightweight argument parsing (object/argv) using a simple schema.
 */

export type ArgType = "string" | "number" | "boolean" | "string[]";

export type ArgSpec = Record<string, { type: ArgType; default?: unknown; alias?: string[] }>;

export type ParsedArgs = Record<string, unknown>;

type ArgValue<T extends ArgType> =
  T extends "string" ? string :
  T extends "number" ? number :
  T extends "boolean" ? boolean :
  T extends "string[]" ? string[] : never;

type HasDefault<D> = D extends { default: unknown } ? true : false;

export type FromArgSpec<S extends ArgSpec> = (
  // required keys: those with an explicit default present
  { [K in keyof S as HasDefault<S[K]> extends true ? K : never]: ArgValue<S[K]["type"]> }
) & (
  // optional keys: those without default
  { [K in keyof S as HasDefault<S[K]> extends true ? never : K]?: ArgValue<S[K]["type"]> }
);
