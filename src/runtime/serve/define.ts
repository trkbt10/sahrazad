/**
 * @file Helpers to build an ActionRegistry with parsed args.
 */
import type { ArgSpec, FromArgSpec } from "../args/types";
import { parseObjectArgs } from "../args/object";
import type { ActionHandler, ActionRegistry, ActionName } from "./actions";
import Ajv, { type JSONSchemaType, type ErrorObject } from "ajv";

/** Wrap an action impl with object-arg parsing according to ArgSpec. */
export function defineAction<S extends ArgSpec>(
  spec: S,
  impl: (parsed: FromArgSpec<S>) => Promise<Record<string, unknown>>,
): ActionHandler {
  return async (args: Record<string, unknown>) => {
    const parsed = parseObjectArgs(args, spec);
    const out = await impl(parsed);
    return out;
  };
}

export type ActionDef<S extends ArgSpec = ArgSpec> = {
  spec: S;
  impl: (parsed: FromArgSpec<S>) => Promise<Record<string, unknown>>;
};

/** Build an ActionRegistry from a map of { actionName: { spec, impl } }. */
export function defineActions(defs: Record<ActionName, ActionDef>): ActionRegistry {
  const out: Record<string, ActionHandler> = {};
  const entries = Object.entries(defs);
  for (const [name, def] of entries) {
    out[name] = defineAction(def.spec, def.impl);
  }
  return out as ActionRegistry;
}

// JSON Schema variants (Ajv-based)
const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  useDefaults: true,
  removeAdditional: false,
});

/**
 * Wrap an action implementation with Ajv JSON Schema validation/coercion.
 * - Applies defaults and type coercions according to schema.
 * - Throws with a concise error message when validation fails.
 */
export function defineJsonAction<T>(schema: JSONSchemaType<T>, impl: (parsed: T) => Promise<Record<string, unknown>>): ActionHandler {
  const validate = ajv.compile<T>(schema);
  return async (args: Record<string, unknown>) => {
    // Clone to allow Ajv to apply defaults/coercions without mutating caller object
    const data: unknown = JSON.parse(JSON.stringify(args));
    if (!validate(data)) {
      const errs = (validate.errors ?? [])
        .map((e: ErrorObject) => {
          const path = typeof e.instancePath === "string" && e.instancePath.length > 0 ? e.instancePath : ".";
          const msg = e.message ?? "invalid";
          return `${path} ${msg}`;
        })
        .join(", ");
      throw new Error(`Invalid arguments: ${errs}`);
    }
    const out = await impl(data as T);
    return out;
  };
}

// Intentionally omit multi-action helper for JSON Schema to keep typing precise.
