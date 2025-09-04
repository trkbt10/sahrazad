/**
 * @file Tests for recall query API.
 */
import { createKnowledgeGraphStore } from "../services/knowledge-graph/graph";
import type { KnowledgeGraphEngineApi } from "../services/knowledge-graph/engine";
import { createRecallQueryApi } from "./query";

describe("createRecallQueryApi", () => {
  it("returns hits with neighbors from graph", async () => {
    const g = createKnowledgeGraphStore();
    const fileId = "file://src/a.ts";
    const symId = "symbol://src/a.ts::value:fn#1";
    g.upsertNode({ id: fileId, type: "File", props: { path: "src/a.ts" } });
    g.upsertNode({ id: symId, type: "Symbol", props: { module: "src/a.ts", name: "fn", kind: "Function" } });
    g.addEdge({ from: fileId, to: symId, type: "CONTAINS" });

    const engine: KnowledgeGraphEngineApi = {
      load: async () => {},
      save: async () => {},
      getGraph: () => g,
      mergeGraph: () => {},
      deleteByPaths: () => {},
      upsertEmbeddings: async () => {},
    };

    const fakeClient = {
      async findMany() { return [{ id: 1, score: 0.9, meta: { nodeId: symId, kind: "symbol", path: "src/a.ts", symbol: "fn" } }]; },
    };
    const api = createRecallQueryApi({ engine, embed: async (inputs) => inputs.map(() => [1, 2, 3, 4]), client: fakeClient });

    const res = await api.recall({ text: "fn", topK: 1, includeNeighbors: { dir: "both" } });
    expect(res.length).toBe(1);
    expect(res[0]?.neighbors.length).toBe(1);
    expect(res[0]?.neighbors[0]?.type).toBe("CONTAINS");
  });
});
