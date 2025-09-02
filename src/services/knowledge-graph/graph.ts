/**
 * @file Minimal in-memory Knowledge Graph store with JSON (de)serialization.
 */
import type { KnowledgeEdge, KnowledgeNode } from "./types";

export type KnowledgeGraphStore = {
  nodes: Map<string, KnowledgeNode>;
  edges: KnowledgeEdge[];
  addNode: (n: KnowledgeNode) => void;
  upsertNode: (n: KnowledgeNode) => void;
  removeNode: (id: string) => void;
  addEdge: (e: KnowledgeEdge) => void;
  removeEdgesBy: (fn: (e: KnowledgeEdge) => boolean) => void;
  neighbors: (id: string, dir?: "out" | "in" | "both") => KnowledgeEdge[];
  toJSON: () => { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };
};

/**
 * Create a minimal in-memory knowledge graph store.
 *
 * - Upsert merges node props.
 * - Edges can be filtered out by predicate and queried by direction.
 */
export function createKnowledgeGraphStore(): KnowledgeGraphStore {
  const nodes = new Map<string, KnowledgeNode>();
  const edges: KnowledgeEdge[] = [];
  const addNode = (n: KnowledgeNode) => { nodes.set(n.id, n); };
  const upsertNode = (n: KnowledgeNode) => {
    const prev = nodes.get(n.id);
    nodes.set(n.id, { ...(prev ?? {}), ...n, props: { ...(prev?.props ?? {}), ...(n.props ?? {}) } });
  };
  const removeNode = (id: string) => {
    nodes.delete(id);
    const kept = edges.filter((e) => e.from !== id && e.to !== id);
    edges.splice(0, edges.length, ...kept);
  };
  const addEdge = (e: KnowledgeEdge) => { edges.push(e); };
  const removeEdgesBy = (fn: (e: KnowledgeEdge) => boolean) => {
    const kept = edges.filter((e) => !fn(e));
    edges.splice(0, edges.length, ...kept);
  };
  const neighbors = (id: string, dir: "out" | "in" | "both" = "both") => {
    const out = edges.filter((e) => e.from === id);
    const incoming = edges.filter((e) => e.to === id);
    if (dir === "out") { return out; }
    if (dir === "in") { return incoming; }
    return [...out, ...incoming];
  };
  const toJSON = () => ({ nodes: [...nodes.values()], edges });

  return { nodes, edges, addNode, upsertNode, removeNode, addEdge, removeEdgesBy, neighbors, toJSON };
}

/**
 * Restore a KnowledgeGraphStore from a plain JSON object.
 * Silently ignores malformed inputs and returns an empty store.
 */
export function knowledgeGraphFromJSON(input: unknown): KnowledgeGraphStore {
  const g = createKnowledgeGraphStore();
  if (!input || typeof input !== "object") { return g; }
  const j = input as { nodes?: KnowledgeNode[]; edges?: KnowledgeEdge[] };
  for (const n of j.nodes ?? []) { g.nodes.set(n.id, n); }
  g.edges.splice(0, g.edges.length, ...j.edges ?? []);
  return g;
}

