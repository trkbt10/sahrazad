/**
 * @file Tests for KnowledgeGraph engine operations and embedding upserts (with fakes).
 */
import path from "node:path";
import { createNodeFileIO } from "vcdb/storage/node";
import { createMemoryFileIO } from "vcdb/storage/memory";
import { connect } from "vcdb";
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

  it("upserts embeddings using injected embed function and vcdb (memory)", async () => {
    const io = createNodeFileIO(path.join(process.cwd(), ".kg-test"));
    const engine = createKnowledgeGraphEngine({ repoDir: process.cwd(), io });
    await engine.load();

    const memIndex = createMemoryFileIO();
    const memData = createMemoryFileIO();
    const client = await connect<Meta>({
      storage: { index: memIndex, data: memData },
      database: { dim: 4, metric: "cosine", strategy: "bruteforce" },
      index: { name: "test", segmented: false },
    });
    const embed = async (inputs: readonly string[]) => inputs.map((s) => Array.from({ length: 4 }, (_, i) => i + s.length));

    await engine.upsertEmbeddings({
      client,
      items: [
        { key: "k:a", text: "hello", meta: { nodeId: "n1", kind: "file" } as const },
        { key: "k:b", text: "world!!", meta: { nodeId: "n2", kind: "symbol" } as const },
      ],
      embed,
      batch: 1,
    });
    const hit = await client.find(new Float32Array([1, 2, 3, 4]), {});
    expect(hit).not.toBeNull();
  });
});
