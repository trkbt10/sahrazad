/**
 * @file Recall query: vector search + graph neighborhood expansion.
 */
import type { RecallQueryArgs } from "./types";
import { shouldIgnore } from "./domain/ignore";
import { isFileId } from "./domain/identifiers";
import type { KnowledgeGraphEngineApi } from "../services/knowledge-graph/engine";
import type { EmbedMany } from "../services/embedding";

export type RecallResult = {
  hit: { id: number; score?: number; distance?: number; meta?: unknown };
  neighbors: { from: string; to: string; type: string; props?: Record<string, unknown> }[];
};

/** Create a recall API that combines vector search with graph neighbors. */
type MinimalSearch = { findMany: (q: Float32Array, opts: { k?: number }) => Promise<Array<{ id: number; score: number; meta: unknown }>> };
export function createRecallQueryApi({ engine, embed, client, ignore }: { engine: KnowledgeGraphEngineApi; embed: EmbedMany; client: MinimalSearch; ignore?: string[] }) {
  async function recall(args: RecallQueryArgs): Promise<ReadonlyArray<RecallResult>> {
    if (!args || !args.text || args.topK <= 0) {
      throw new Error("recall: 'text' and positive 'topK' are required");
    }
    const [vec] = await embed([args.text]);
    if (!vec || vec.length === 0) {
      throw new Error("recall: empty embedding for query");
    }
    const hitsRaw = await client.findMany(new Float32Array(vec as number[]), { k: args.topK });
    function isIgnoredMeta(meta: unknown): boolean {
      if (!meta || typeof meta !== "object") {
        return false;
      }
      const m = meta as { path?: unknown; nodeId?: unknown };
      const path = typeof m.path === "string" ? m.path : undefined;
      const nodeId = typeof m.nodeId === "string" ? m.nodeId : undefined;
      const pats = Array.isArray(ignore) ? (ignore as string[]) : [];
      if (path && shouldIgnore(path, pats)) { return true; }
      if (nodeId && isFileId(nodeId)) {
        const rel = nodeId.slice("file://".length);
        if (shouldIgnore(rel, pats)) { return true; }
      }
      return false;
    }
    function inScope(meta: unknown): boolean {
      const base = args.scopeDir;
      if (!base || base.length === 0) { return true; }
      if (!meta || typeof meta !== "object") { return true; }
      const m = meta as { path?: unknown; nodeId?: unknown };
      const path = typeof m.path === "string" ? m.path : undefined;
      const nodeId = typeof m.nodeId === "string" ? m.nodeId : undefined;
      if (path) {
        if (path.startsWith(base)) { return true; }
      }
      if (nodeId) {
        const fileLike = isFileId(nodeId);
        if (fileLike) {
          const rel = nodeId.slice("file://".length);
          if (rel.startsWith(base)) { return true; }
        }
      }
      return false;
    }

    function keepHit(h: { meta?: unknown }): boolean {
      if (isIgnoredMeta(h.meta)) { return false; }
      if (!inScope(h.meta)) { return false; }
      return true;
    }
    const hits = hitsRaw.filter(keepHit);
    const dir = args.includeNeighbors?.dir ?? "both";
    const g = engine.getGraph();
    const out: RecallResult[] = [];
    function nodeIdFromMeta(meta: unknown): string | undefined {
      if (!meta || typeof meta !== "object") {
        return undefined;
      }
      const m = meta as { nodeId?: unknown };
      if (typeof m.nodeId === "string" && m.nodeId.length > 0) {
        return m.nodeId;
      }
      return undefined;
    }

    function neighborsFor(id: string | undefined) {
      if (!id) {
        return [] as { from: string; to: string; type: string; props?: Record<string, unknown> }[];
      }
      const edges = g.neighbors(id, dir);
      const kept = edges.filter((e) => String(e.props?.kind) !== "parseError");
      return kept.map((e) => ({ from: e.from, to: e.to, type: e.type, props: e.props }));
    }

    for (const h of hits) {
      const id = nodeIdFromMeta(h.meta);
      const neigh = neighborsFor(id);
      out.push({ hit: h as RecallResult["hit"], neighbors: neigh });
    }
    return out;
  }
  return { recall };
}
