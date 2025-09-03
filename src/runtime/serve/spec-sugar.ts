/**
 * @file Minimal-config helpers for ServerSpec.
 *
 * Policy: No implicit magic. Callers must opt into auto-routes via options.
 */
import type { ItemSpec, ServerSpec, ToolSpec, RestMapping } from "./schema";
import type { ActionName } from "./actions";

export type PartialTool = Omit<ToolSpec, "routes"> & { routes?: ToolSpec["routes"] };
export type PartialPrompt = Parameters<Extract<ItemSpec, { type: "prompt" }>["type"] extends never ? never : never>[never];
// Simpler re-declare for clarity
export type PartialPrompt2 = { type: "prompt"; name: string; description: string; input_schema: unknown; action: ActionName };
export type PartialResource = { type: "resource"; name: string; description: string; listAction: ActionName; readAction: ActionName };

export type PartialItem =
  | ({ type: "tool" } & PartialTool)
  | PartialPrompt2
  | PartialResource;

export type PartialServerSpec = { items: PartialItem[] };

export type EnsureOptions = {
  features?: { restful?: boolean; mcp?: boolean };
  restful?: {
    basePath?: string; // default "/api"
    defaultMethod?: RestMapping["method"]; // default "POST"
  };
};

function toolToItemSpec(
  t: PartialTool,
  opts: { restfulEnabled: boolean; basePath: string; defaultMethod: RestMapping["method"] },
): Extract<ItemSpec, { type: "tool" }> {
  const routes = t.routes;
  if (!routes && !opts.restfulEnabled) {
    throw new Error(`routes missing for tool '${t.name}'. Enable features.restful or provide routes explicitly.`);
  }
  const finalRoutes: RestMapping | RestMapping[] | undefined = routes ?? { method: opts.defaultMethod, path: `${opts.basePath}/${t.name}` };
  return { type: "tool", name: t.name, description: t.description, input_schema: t.input_schema, routes: finalRoutes };
}

/** Normalize a partial spec into a full ServerSpec. */
export function ensureServerSpec(input: PartialServerSpec, options?: EnsureOptions): ServerSpec {
  if (!input || !Array.isArray(input.items)) {
    throw new Error("ensureServerSpec: items array is required");
  }
  const restfulEnabled = options?.features?.restful === true;
  const basePath = options?.restful?.basePath && options.restful.basePath.length > 0 ? options.restful.basePath : "/api";
  const defaultMethod: RestMapping["method"] = options?.restful?.defaultMethod ?? "POST";
  const items: ItemSpec[] = [];
  for (const it of input.items) {
    if (it.type === "tool") {
      items.push(toolToItemSpec(it, { restfulEnabled, basePath, defaultMethod }));
      continue;
    }
    if (it.type === "prompt") {
      items.push({ type: "prompt", name: it.name, description: it.description, input_schema: it.input_schema, action: it.action });
      continue;
    }
    if (it.type === "resource") {
      items.push({ type: "resource", name: it.name, description: it.description, listAction: it.listAction, readAction: it.readAction });
      continue;
    }
  }
  return { items };
}
