/**
 * @file Shared types for Knowledge Graph nodes, edges, and vector metadata.
 */
export type NodeType = "File" | "Symbol" | "Commit";
export type EdgeType = "CONTAINS" | "IMPORTS" | "CALLS" | "CHANGED_IN" | "DEFINED_IN";

export type KnowledgeNode = {
  id: string;
  type: NodeType;
  props: Record<string, unknown>;
};

export type KnowledgeEdge = { from: string; to: string; type: EdgeType; props?: Record<string, unknown> };

export type Meta = {
  nodeId: string;
  kind: "file" | "symbol" | "commit";
  path?: string;
  module?: string;
  symbol?: string;
  commit?: string;
  loc?: { start: number; end: number };
  deleted?: boolean;
};

export type VecHit = { id: number; score?: number; distance?: number; meta?: Meta };
