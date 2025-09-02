/**
 * @file Lightweight in-memory code graph for KGF runtime with helpers to add nodes/edges.
 */
import type { CodeGraphJson, Edge, ModuleNode, SymbolNode } from "./types";

export type CodeGraph = {
  modules: Record<string, ModuleNode>;
  symbols: Record<string, SymbolNode>;
  edges: Edge[];
};

/** Create an empty graph container. */
export function createGraph(): CodeGraph {
  return { modules: {}, symbols: {}, edges: [] };
}

/** Get or create a module node. Updates missing file path if newly known. */
export function getOrAddModule(graph: CodeGraph, id: string, file?: string | null): ModuleNode {
  const existing = graph.modules[id];
  if (!existing) {
    const node: ModuleNode = { id, file: file ?? null };
    graph.modules[id] = node;
    return node;
  }
  if (file && !existing.file) {
    existing.file = file;
  }
  return existing;
}

/** Get or create a symbol node under a module with identity fields. */
export function getOrAddSymbol(
  graph: CodeGraph,
  id: string,
  name: string,
  kind: string,
  ns: string,
  module: string,
): SymbolNode {
  const existing = graph.symbols[id];
  if (!existing) {
    const node: SymbolNode = { id, name, kind, ns, module };
    graph.symbols[id] = node;
    return node;
  }
  return existing;
}

/** Add a directed edge with optional attributes. */
export function addEdge(graph: CodeGraph, kind: string, from: string, to: string, attrs?: Record<string, unknown>): void {
  const edge: Edge = { kind, from, to, attrs: attrs ? { ...attrs } : undefined };
  graph.edges.push(edge);
}

/** Convert internal graph to a serializable JSON structure. */
export function toJSON(graph: CodeGraph): CodeGraphJson {
  return {
    modules: Object.fromEntries(
      Object.entries(graph.modules).map(([k, v]) => [k, { file: v.file }]),
    ),
    symbols: Object.fromEntries(
      Object.entries(graph.symbols).map(([k, s]) => [k, { name: s.name, kind: s.kind, ns: s.ns, module: s.module }]),
    ),
    edges: graph.edges.map((e) => ({ kind: e.kind, from: e.from, to: e.to, ...(e.attrs ?? {}) })),
  };
}
