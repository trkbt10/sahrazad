/**
 * @file Default server items for common code-assist use cases.
 */
import type { ItemSpec } from "./schema";

/** Common tools and REST routes for code indexing/search/assist. */
export function createDefaultItems(): ItemSpec[] {
  const tools: Array<Extract<ItemSpec, { type: "tool" }>> = [
    { type: "tool", name: "ingestPaths", description: "Index or reindex code paths", input_schema: {}, routes: { method: "POST", path: "/api/code/index" } },
    { type: "tool", name: "recall", description: "Search semantically across code", input_schema: {}, routes: { method: "POST", path: "/api/code/search" } },
    { type: "tool", name: "task.suggest", description: "Suggest related files for a task", input_schema: {}, routes: { method: "POST", path: "/api/code/related" } },
    { type: "tool", name: "task.outline", description: "Build outline for a set of files", input_schema: {}, routes: { method: "POST", path: "/api/code/outline" } },
    { type: "tool", name: "browse", description: "List immediate children under base path", input_schema: {}, routes: { method: "POST", path: "/api/code/browse" } },
  ];
  return tools;
}
