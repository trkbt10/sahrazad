/**
 * @file Tests for ignore patterns applied in recall (query) results.
 */
import { createRecallQueryApi } from "../src/core/query/index";
import { createKnowledgeGraphStore } from "../src/services/knowledge-graph/graph";
import type { KnowledgeGraphEngineApi } from "../src/services/knowledge-graph/engine";

describe("recall ignore filter", () => {
  it("filters out hits whose meta.path or nodeId matches ignore patterns", async () => {
    const g = createKnowledgeGraphStore();
    // Add two file nodes
    g.upsertNode({ id: "file://src/app.ts", type: "File", props: { path: "src/app.ts" } });
    g.upsertNode({ id: "file://.git/index", type: "File", props: { path: ".git/index" } });
    // Add a parseError edge on src/app.ts to verify neighbor filtering
    g.addEdge({ from: "file://src/app.ts", to: "file://src/app.ts", type: "CONTAINS", props: { kind: "parseError", message: "x" } });

    const engine: KnowledgeGraphEngineApi = {
      load: async () => {},
      save: async () => {},
      getGraph: () => g,
      mergeGraph: () => {},
      deleteByPaths: () => {},
      upsertEmbeddings: async () => {},
    };

    const vectorClient = {
      async findMany() {
        return [
          { id: 1, score: 0.9, meta: { nodeId: "file://.git/index", kind: "file", path: ".git/index" } },
          { id: 2, score: 0.8, meta: { nodeId: "file://src/app.ts", kind: "file", path: "src/app.ts" } },
        ];
      },
    };

    const api = createRecallQueryApi({ engine, embed: async (inputs) => inputs.map(() => [0.1, 0.2]), client: vectorClient, ignore: [".git/"] });

    const res = await api.recall({ text: "app", topK: 5 });
    expect(res.length).toBe(1);
    expect((res[0]?.hit.meta as { path?: string })?.path).toBe("src/app.ts");
    // parseError neighbors are filtered out
    expect(res[0]?.neighbors.length).toBe(0);
  });
});
