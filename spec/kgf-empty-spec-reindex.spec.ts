/**
 * @file Ensure KGF empty spec does not emit parseError and reindex drops stale parseError edges.
 */
// Vitest globals are provided by the runner; no import here.
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createKnowledgeGraphEngine } from "../src/services/knowledge-graph/engine";
import { createIngestPipeline } from "../src/core/ingest/pipeline";
import type { KnowledgeGraphStore } from "../src/services/knowledge-graph/graph";
import { createNodeFileIO } from "vcdb/storage/node";

function hasParseErrorEdges(g: KnowledgeGraphStore, fileRel: string): boolean {
  const id = `file://${fileRel}`;
  return g.edges.some((e) => e.from === id && e.to === id && String(e.props?.kind) === "parseError");
}

describe("KGF empty spec reindex", () => {
  it("removes previous parseError edges and does not add new ones", async () => {
    const base = mkdtempSync(join(tmpdir(), "kgf-empty-spec-"));
    const repoDir = join(base, "repo");
    const dataDir = join(base, "data");
    writeFileSync(join(repoDir, "a.ts"), "export const x = 1;\n");

    const io = createNodeFileIO(dataDir);
    const engine = createKnowledgeGraphEngine({ repoDir, io });
    await engine.load();

    // Seed a stale parseError edge (as if from a previous buggy run)
    const g0 = engine.getGraph();
    g0.upsertNode({ id: "file://a.ts", type: "File", props: { path: "a.ts" } });
    g0.addEdge({ from: "file://a.ts", to: "file://a.ts", type: "CONTAINS", props: { kind: "parseError", message: "old" } });
    await engine.save();

    // Ingest with empty spec: no tokens/rules → no parse execution
    
    // Minimal VectorDB stub for tests
    // Use in-memory vcdb for test
    const { createMemoryFileIO } = await import("vcdb/storage/memory");
    const { connect } = await import("vcdb");
    const memIndex = createMemoryFileIO();
    const memData = createMemoryFileIO();
    const fakeDb = await connect<import("../src/services/knowledge-graph/types").Meta>({
      storage: { index: memIndex, data: memData },
      database: { dim: 4, metric: "cosine", strategy: "bruteforce" },
      index: { name: "test", segmented: false },
    });
    const pipeline = createIngestPipeline({
      repoDir,
      projectRoot: repoDir,
      kgfSpec: { language: "typescript", tokens: [], rules: {}, attrs: {}, resolver: { sources: [], relative_prefixes: [], exts: [], indexes: [], bare_prefix: "", module_path_style: "slash", aliases: [], ns_segments: 2, rust_mod_mode: false, cargo_auto_from_roots: [] } },
      engine,
      embed: async (ins) => ins.map(() => new Array(1).fill(0)),
      vector: { db: fakeDb },
    });

    await pipeline.ingestPaths([join(repoDir, "a.ts")], { save: true, embed: false });

    const g1 = engine.getGraph();
    expect(hasParseErrorEdges(g1, "a.ts")).toBe(false);

    // Cleanup temp
    rmSync(base, { recursive: true, force: true });
  });
});
