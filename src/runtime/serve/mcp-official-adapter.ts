/**
 * @file Adapter helpers to register tools on an official MCP SDK server instance using a schema and action registry.
 * The host application constructs the official Server and passes a minimal adapter that exposes `registerTool` and `start`.
 */
import type { ServerSpec } from "./schema";
import type { ActionRegistry } from "./actions";

export type McpToolDef = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type McpOfficialAdapter = {
  registerTool: (
    def: McpToolDef,
    handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>,
  ) => void;
  registerPrompt?: (
    def: { name: string; description?: string; inputSchema?: unknown },
    handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>,
  ) => void;
  registerResource?: (
    def: { name: string; description?: string },
    list: () => Promise<Record<string, unknown>> | Record<string, unknown>,
    read: (args: Record<string, unknown>) => Promise<Record<string, unknown>>,
  ) => void;
  start: () => Promise<void> | void;
};

/**
 * Register schema-declared tools on an official MCP SDK server adapter.
 *
 * - Does not depend on core logic; delegates tool calls to the provided action registry.
 * - The adapter is a thin facade over the official SDK server instance owned by the host app.
 */
export function registerMcpToolsOn(adapter: McpOfficialAdapter, spec: ServerSpec, actions: ActionRegistry): void {
  for (const item of spec.items) {
    if (item.type === "tool") {
      const name = item.name;
      const handler = actions[name];
      adapter.registerTool({ name, description: item.description, inputSchema: item.input_schema }, async (args) => {
        const res = await handler(args);
        return res;
      });
      continue;
    }
    if (item.type === "prompt" && adapter.registerPrompt) {
      const handler = actions[item.action];
      adapter.registerPrompt({ name: item.name, description: item.description, inputSchema: item.input_schema }, async (args) => {
        const res = await handler(args);
        return res;
      });
      continue;
    }
    if (item.type === "resource" && adapter.registerResource) {
      const listAction = actions[item.listAction];
      const readAction = actions[item.readAction];
      adapter.registerResource(
        { name: item.name, description: item.description },
        async () => listAction({}),
        async (args) => readAction(args),
      );
      continue;
    }
  }
}
