/**
 * @file Tests for recall query API.
 */
import { createKnowledgeGraphStore } from "../../services/knowledge-graph/graph";
import type { KnowledgeGraphEngineApi } from "../../services/knowledge-graph/engine";
import { createRecallQueryApi, recallImpl, isIgnoredMeta, inScope, pathFromMeta } from "./index";

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
    const api = createRecallQueryApi({ engine, embed: async (inputs: readonly string[]) => inputs.map(() => [1, 2, 3, 4] as number[]), client: fakeClient });

    const res = await api.recall({ text: "fn", topK: 1, includeNeighbors: { dir: "both" } });
    expect(res.length).toBe(1);
    expect(res[0]?.neighbors.length).toBe(1);
    expect(res[0]?.neighbors[0]?.type).toBe("CONTAINS");
  });

  it("recallImpl filters by ignore and scope via extracted helpers", async () => {
    const g = createKnowledgeGraphStore();
    const fileId = "file://src/keep/a.ts";
    const badFileId = "file://src/ignore/b.ts";
    g.upsertNode({ id: fileId, type: "File", props: { path: "src/keep/a.ts" } });
    g.upsertNode({ id: badFileId, type: "File", props: { path: "src/ignore/b.ts" } });
    g.addEdge({ from: fileId, to: badFileId, type: "IMPORTS" });

    const engine: KnowledgeGraphEngineApi = {
      load: async () => {},
      save: async () => {},
      getGraph: () => g,
      mergeGraph: () => {},
      deleteByPaths: () => {},
      upsertEmbeddings: async () => {},
    };
    const fakeClient = {
      async findMany() {
        return [
          { id: 1, score: 0.9, meta: { nodeId: fileId, kind: "file", path: "src/keep/a.ts" } },
          { id: 2, score: 0.8, meta: { nodeId: badFileId, kind: "file", path: "src/ignore/b.ts" } },
        ];
      },
    };
    const deps = { engine, embed: async (inputs: readonly string[]) => inputs.map(() => [1, 1, 1] as number[]), client: fakeClient };

    // Validate helpers independently
    expect(pathFromMeta({ path: "src/x.ts" })).toBe("src/x.ts");
    expect(isIgnoredMeta({ path: "src/ignore/b.ts" }, ["src/ignore"])) .toBe(true);
    expect(inScope({ path: "src/keep/a.ts" }, "src/keep")).toBe(true);

    const res = await recallImpl({ ...deps, ignore: ["src/ignore/**"] }, { text: "query", topK: 10, scopeDir: "src/keep" });
    expect(res.length).toBe(1);
    expect((res[0]?.hit.meta as { path?: string })?.path).toBe("src/keep/a.ts");
  });
});
