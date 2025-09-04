/**
 * @file Unit tests for schema-driven Hono app builder.
 */
import { buildHttpHandlerFromSpec } from "./schema";
import type { ServerSpec } from "./schema";
import type { ActionRegistry } from "./actions";

describe("buildHttpHandlerFromSpec", () => {
  it("registers /health and declared endpoints; POST delegates to action handler", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const actions: ActionRegistry = {
      async ingestPaths(args) {
        calls.push({ name: "ingestPaths", args });
        const out: Record<string, unknown> = { ok: true, received: args };
        return out;
      },
      async recall(args) {
        calls.push({ name: "recall", args });
        const out: Record<string, unknown> = { items: [], q: args.q };
        return out;
      },
      async "task.suggest"(args) {
        calls.push({ name: "task.suggest", args });
        const out: Record<string, unknown> = { suggestions: ["a", "b"] };
        return out;
      },
      async "task.outline"(args) {
        calls.push({ name: "task.outline", args });
        const out: Record<string, unknown> = { outline: ["1", "2"] };
        return out;
      },
    };

    const spec: ServerSpec = {
      items: [
        { type: "tool", name: "recall", description: "ping", input_schema: {}, routes: { method: "GET", path: "/v1/ping" } },
        { type: "tool", name: "ingestPaths", description: "ingest", input_schema: {}, routes: { method: "POST", path: "/v1/ingest" } },
      ],
    };

    const app = buildHttpHandlerFromSpec(spec, actions);

    const req = (path: string, init?: RequestInit) => app.fetch(new Request(`http://local${path}`, init));

    // GET /health
    const r1 = await req("/health");
    const j1 = (await r1.json()) as { ok?: boolean };
    expect(j1.ok).toBe(true);

    // GET route declared in spec executes the action and returns its payload.
    const r2 = await req("/v1/ping");
    const j2 = (await r2.json()) as { items?: unknown[]; q?: unknown };
    expect(Array.isArray(j2.items)).toBe(true);
    // Ensure the action was called
    expect(calls.map((c) => c.name)).toContain("recall");

    // POST route should call the action handler with JSON body.
    const payload = { paths: ["a", "b"] } as const;
    const r3 = await req("/v1/ingest", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    const j3 = (await r3.json()) as { ok?: boolean; received?: unknown };
    expect(j3.ok).toBe(true);
    expect(Array.isArray((j3.received as { paths?: unknown[] } | undefined)?.paths)).toBe(true);

    // Ensure the action was actually called with our args
    const names = calls.map((c) => c.name);
    expect(names).toContain("ingestPaths");
    const last = calls[calls.length - 1];
    expect((last?.args as { paths?: unknown[] } | undefined)?.paths).toEqual(["a", "b"]);
  });
});
