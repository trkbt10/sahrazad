/**
 * @file Unit tests for registering MCP tools on an adapter facade.
 */
import { registerMcpToolsOn } from "./mcp-official-adapter";
import type { McpOfficialAdapter } from "./mcp-official-adapter";
import type { ServerSpec } from "./schema";
import type { ActionRegistry } from "./actions";

describe("registerMcpToolsOn", () => {
  it("registers tools from spec and delegates calls to action handlers", async () => {
    const registrations: Array<{ name: string; description?: string; inputSchema?: unknown }>
      = [] as Array<{ name: string; description?: string; inputSchema?: unknown }>;
    const handlers: Record<string, (args: Record<string, unknown>) => Promise<Record<string, unknown>>> = {};

    const adapter: McpOfficialAdapter = {
      registerTool(def, handler) {
        registrations.push(def);
        handlers[def.name] = handler;
      },
      start() {},
    };

    const spec: ServerSpec = {
      items: [
        { type: "tool", name: "task.suggest", description: "suggest tasks", input_schema: { type: "object" } },
        { type: "tool", name: "task.outline", description: "outline tasks", input_schema: { type: "object" } },
      ],
    };

    const calls: Array<string> = [];
    const actions: ActionRegistry = {
      async ingestPaths(args) {
        calls.push("ingestPaths");
        const out: Record<string, unknown> = { ok: true, args };
        return out;
      },
      async recall(args) {
        calls.push("recall");
        const out: Record<string, unknown> = { ok: true, args };
        return out;
      },
      async "task.suggest"(args) {
        calls.push("task.suggest");
        const out: Record<string, unknown> = { suggestions: [String(args["q"] ?? "")] };
        return out;
      },
      async "task.outline"(args) {
        calls.push("task.outline");
        const out: Record<string, unknown> = { outline: [String(args["topic"] ?? "")] };
        return out;
      },
    };

    registerMcpToolsOn(adapter, spec, actions);

    // Two tools should be registered
    const names = registrations.map((r) => r.name).sort();
    expect(names).toEqual(["task.outline", "task.suggest"]);

    // Calling registered handler should delegate to the corresponding action
    const res1 = await handlers["task.suggest"]({ q: "x" });
    const res2 = await handlers["task.outline"]({ topic: "y" });

    expect(calls).toEqual(["task.suggest", "task.outline"]);
    expect(typeof res1).toBe("object");
    expect(typeof res2).toBe("object");
  });
});
