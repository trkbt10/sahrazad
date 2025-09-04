/**
 * @file Tests for KnowledgeGraph engine operations and embedding upserts (with fakes).
 */
import path from "node:path";
import { createNodeFileIO } from "vcdb/storage/node";
import { createKnowledgeGraphStore } from "./graph";
import type { Meta } from "./types";
import { createKnowledgeGraphEngine } from "./engine";

describe("KnowledgeGraph engine", () => {
  it("merges graphs and deletes by paths", async () => {
    const io = createNodeFileIO(path.join(process.cwd(), ".kg-test"));
    const engine = createKnowledgeGraphEngine({ repoDir: process.cwd(), io });
    await engine.load();

    const g = createKnowledgeGraphStore();
    const fileId = "file://src/x.ts";
    const symId = "symbol://src/x.ts#function:fn";
    g.addNode({ id: fileId, type: "File", props: { path: "src/x.ts" } });
    g.addNode({ id: symId, type: "Symbol", props: { path: "src/x.ts", kind: "function", name: "fn" } });
    g.addEdge({ from: fileId, to: symId, type: "CONTAINS" });
    engine.mergeGraph(g);
    expect(engine.getGraph().nodes.has(fileId)).toBe(true);

    engine.deleteByPaths(["src/x.ts"].map((p) => `${process.cwd()}/${p}`));
    expect(engine.getGraph().nodes.has(fileId)).toBe(false);
  });

  it("upserts embeddings using injected embed function and client", async () => {
    const io = createNodeFileIO(path.join(process.cwd(), ".kg-test"));
    const engine = createKnowledgeGraphEngine({ repoDir: process.cwd(), io });
    await engine.load();

    const collected: { id: number; vector: Float32Array; meta: Meta }[] = [];
    const fakeClient = {
      state: {},
      size: 0,
      index: {},
      async has() { return false; },
      async get() { return null; },
      async set() { return null; },
      async delete() { return false; },
      async push() { return 0; },
      async upsert(...rows: { id: number; vector: Float32Array; meta: Meta }[]) { collected.push(...rows); return rows.length; },
      async setMeta() { return true; },
      async setVector() { return true; },
      async find() { return null; },
      async findMany() { return []; },
    };
    const embed = async (inputs: readonly string[]) => inputs.map((s) => Array.from({ length: 4 }, (_, i) => i + s.length));

    await engine.upsertEmbeddings({
      client: fakeClient,
      items: [
        { key: "k:a", text: "hello", meta: { nodeId: "n1", kind: "file" } as const },
        { key: "k:b", text: "world!!", meta: { nodeId: "n2", kind: "symbol" } as const },
      ],
      embed,
      batch: 1,
    });

    expect(collected.length).toBe(2);
    expect(collected[0]?.vector.length).toBe(4);
  });
});
