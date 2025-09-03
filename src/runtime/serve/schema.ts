/**
 * @file Schema-driven server bootstrapping for REST (Hono) and MCP.
 * Decoupled from runtime logic: callers provide action handlers.
 */
import { Hono as HonoCtor } from "hono";
import { serve } from "@hono/node-server";
import type { ActionName, ActionRegistry } from "./actions";

export type RestMapping = { method: "GET" | "POST"; path: string };

export type ToolSpec = {
  name: ActionName;
  description: string;
  input_schema: unknown;
  routes?: RestMapping | RestMapping[];
};

export type PromptSpec = {
  name: string;
  description: string;
  input_schema: unknown;
  action: ActionName;
};

export type ResourceSpec = {
  name: string;
  description: string;
  listAction: ActionName;
  readAction: ActionName;
};

export type ItemSpec =
  | ({ type: "tool" } & ToolSpec)
  | ({ type: "prompt" } & PromptSpec)
  | ({ type: "resource" } & ResourceSpec);

export type ServerSpec = {
  items: ItemSpec[];
};

export type HttpApp = { fetch: (req: Request) => Response | Promise<Response> };

/** Build an HTTP handler (Fetch) from a schema using injected action handlers. */
export function buildHttpHandlerFromSpec(spec: ServerSpec, actions: ActionRegistry): HttpApp {
  const app = new HonoCtor();
  app.get("/health", (c) => c.json({ ok: true }));

  // REST routes: derive from tools that declare route exposure.
  for (const item of spec.items) {
    if (item.type !== "tool") { continue; }
    const t = item as Extract<ItemSpec, { type: "tool" }>;
    const expose = t.routes;
    if (!expose) { continue; }
    const mappings = Array.isArray(expose) ? expose : [expose];
    for (const m of mappings) {
      if (m.method === "POST") {
        app.post(m.path, async (c) => {
          try {
            const body = await c.req.json();
            const fn = actions[t.name];
            const result = await fn(body as Record<string, unknown>);
            const payload = { ...result };
            return c.json(payload);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return c.json({ error: message }, 400);
          }
        });
        continue;
      }
      if (m.method === "GET") {
        app.get(m.path, async (c) => {
          const url = new URL(c.req.url);
          const args: Record<string, unknown> = {};
          for (const [k, v] of url.searchParams.entries()) {
            args[k] = v;
          }
          const fn = actions[t.name];
          const result = await fn(args);
          const payload = { ...result };
          return c.json(payload);
        });
      }
    }
  }
  const httpApp: HttpApp = { fetch: (req: Request) => app.fetch(req) };
  return httpApp;
}

/**
 * Start a REST server (Hono) from a ServerSpec and action registry.
 *
 * - Creates the app via buildHttpHandlerFromSpec and serves it on the given port.
 * - Returns a simple handle with the app (close is owned by the caller’s runtime).
 */
export function startRestFromSpec(spec: ServerSpec, actions: ActionRegistry, { port }: { port: number }) {
  const app = buildHttpHandlerFromSpec(spec, actions);
  serve({ fetch: app.fetch, port });
  return { app };
}
