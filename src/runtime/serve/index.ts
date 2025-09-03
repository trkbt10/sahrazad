/**
 * @file Public entry for schema-driven runtime serving (REST + MCP adapters).
 * Public API avoids leaking the underlying router implementation.
 */
export type { ActionName, ActionHandler, ActionRegistry } from "./actions";
export { extractEndpointsFromSpec } from "./endpoints";
export type { ServerSpec, ToolSpec, PromptSpec, ResourceSpec, ItemSpec, HttpApp } from "./schema";
export { buildHttpHandlerFromSpec, startRestFromSpec } from "./schema";
export type { McpOfficialAdapter } from "./mcp-official-adapter";
export { registerMcpToolsOn } from "./mcp-official-adapter";
export { ensureServerSpec } from "./spec-sugar";
export { defineAction, defineActions, defineJsonAction } from "./define";
