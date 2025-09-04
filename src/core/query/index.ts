/**
 * @file Recall query: vector search + graph neighborhood expansion.
 */
import type { RecallQueryArgs } from "../types";
import { shouldIgnore } from "../domain/ignore";
import { isFileId, filePathFromId } from "../domain/identifiers";
import type { KnowledgeGraphEngineApi } from "../../services/knowledge-graph/engine";
import type { EmbedMany } from "../../services/embedding/index";
import type { KnowledgeGraphStore } from "../../services/knowledge-graph/graph";

export type RecallResult = {
  hit: { id: number; score?: number; distance?: number; meta?: unknown };
  neighbors: { from: string; to: string; type: string; props?: Record<string, unknown> }[];
};

/** Create a recall API that combines vector search with graph neighbors. */
type MinimalSearch = {
  findMany: (q: Float32Array, opts: { k?: number }) => Promise<Array<{ id: number; score: number; meta: unknown }>>;
};
/** Narrow unknown to a meta-like object with optional path/nodeId. */
type MetaLike = { path?: unknown; nodeId?: unknown };
function isMetaLike(x: unknown): x is MetaLike {
  return !!x && typeof x === "object";
}
function hasPath(m: MetaLike): m is { path: string } {
  return typeof (m as { path?: unknown }).path === "string";
}
function hasNodeId(m: MetaLike): m is { nodeId: string } {
  const v = (m as { nodeId?: unknown }).nodeId;
  return typeof v === "string" && v.length > 0;
}
/** Extract file path from hit meta, if present. */
export function pathFromMeta(meta: unknown): string | undefined {
  if (!isMetaLike(meta)) {
    return undefined;
  }
  const m = meta as MetaLike;
  if (hasPath(m)) {
    return m.path;
  }
  if (hasNodeId(m)) {
    const id = String(m.nodeId);
    if (isFileId(id)) {
      return filePathFromId(id);
    }
  }
  return undefined;
}

/** Whether meta matches ignore patterns (repo-relative). */
export function isIgnoredMeta(meta: unknown, patterns: readonly string[]): boolean {
  if (!isMetaLike(meta)) {
    return false;
  }
  const m = meta as MetaLike;
  const path = pathFromMeta(m);
  if (path && shouldIgnore(path, patterns)) {
    return true;
  }
  if (hasNodeId(m) && isFileId(m.nodeId)) {
    const rel = m.nodeId.slice("file://".length);
    if (shouldIgnore(rel, patterns)) {
      return true;
    }
  }
  return false;
}

/** Whether meta is inside scopeDir, if provided. */
export function inScope(meta: unknown, scopeDir: string | undefined): boolean {
  if (!scopeDir || scopeDir.length === 0) {
    return true;
  }
  if (!isMetaLike(meta)) {
    return true;
  }
  const m = meta as MetaLike;
  const path = pathFromMeta(m);
  if (path && path.startsWith(scopeDir)) {
    return true;
  }
  if (hasNodeId(m) && isFileId(m.nodeId)) {
    const rel = m.nodeId.slice("file://".length);
    if (rel.startsWith(scopeDir)) {
      return true;
    }
  }
  return false;
}

/** Keep only hits that are not ignored and within scope. */
export function keepHit(h: { meta?: unknown }, patterns: readonly string[], scopeDir: string | undefined): boolean {
  if (isIgnoredMeta(h.meta, patterns)) {
    return false;
  }
  if (!inScope(h.meta, scopeDir)) {
    return false;
  }
  return true;
}

/** Extract nodeId from meta if present. */
export function nodeIdFromMeta(meta: unknown): string | undefined {
  if (!isMetaLike(meta)) {
    return undefined;
  }
  const m = meta as MetaLike;
  if (hasNodeId(m)) {
    return m.nodeId;
  }
  return undefined;
}

/** Map graph neighbors of a node to serializable shape, filtering parseError. */
export function neighborsFor(
  g: KnowledgeGraphStore,
  id: string | undefined,
  dir: "out" | "in" | "both",
): { from: string; to: string; type: string; props?: Record<string, unknown> }[] {
  if (!id) {
    return [];
  }
  const edges = g.neighbors(id, dir);
  const kept = edges.filter((e) => String(e.props?.kind) !== "parseError");
  return kept.map((e) => ({ from: e.from, to: e.to, type: e.type, props: e.props }));
}

export type RecallDeps = {
  engine: KnowledgeGraphEngineApi;
  embed: EmbedMany;
  client: MinimalSearch;
  ignore?: string[];
};

/**
 * Non-curried implementation for recall to ease testing.
 */
export async function recallImpl(deps: RecallDeps, args: RecallQueryArgs): Promise<ReadonlyArray<RecallResult>> {
  if (!args || !args.text || args.topK <= 0) {
    throw new Error("recall: 'text' and positive 'topK' are required");
  }
  const [vec] = await deps.embed([args.text]);
  if (!vec || vec.length === 0) {
    throw new Error("recall: empty embedding for query");
  }
  const hitsRaw = await deps.client.findMany(new Float32Array(vec as number[]), { k: args.topK });
  const patterns = Array.isArray(deps.ignore) ? (deps.ignore as string[]) : [];
  const hits = hitsRaw.filter((h) => keepHit(h, patterns, args.scopeDir));
  const dir = args.includeNeighbors?.dir ?? "both";
  const g = deps.engine.getGraph();
  const out: RecallResult[] = [];
  for (const h of hits) {
    const id = nodeIdFromMeta(h.meta);
    const neigh = neighborsFor(g, id, dir);
    out.push({ hit: h as RecallResult["hit"], neighbors: neigh });
  }
  return out;
}

/**
 * Create a recall API that embeds the query, searches vector DB, filters by ignore/scope, and returns neighbors.
 */
export function createRecallQueryApi({ engine, embed, client, ignore }: RecallDeps) {
  async function recall(args: RecallQueryArgs): Promise<ReadonlyArray<RecallResult>> {
    return recallImpl({ engine, embed, client, ignore }, args);
  }
  return { recall };
}
