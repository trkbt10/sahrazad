/**
 * @file Core reusable helpers to slim modules and ease testing.
 */
import type { KnowledgeGraphEngineApi } from "../services/knowledge-graph/engine";
import { isFileId, filePathFromId } from "./domain/identifiers";

/** Build default text for an entity to embed. */
export function defaultTextForMeta(m: { kind: "file" | "symbol" | "commit"; nodeId: string; path?: string; symbol?: string }): string {
  if (m.kind === "file") {
    const p = m.path ?? m.nodeId;
    return `file ${p}`;
  }
  if (m.kind === "symbol") {
    const s = m.symbol ?? m.nodeId;
    const p = m.path ? ` in ${m.path}` : "";
    return `symbol ${s}${p}`;
  }
  return m.nodeId;
}

/** Resolve a graph node id to a file path when possible. */
/** Resolve a graph node id to a file path when possible. */
export function nodeIdToFilePath(getGraph: KnowledgeGraphEngineApi["getGraph"], nodeId: string): string | undefined {
  const graph = getGraph();
  if (isFileId(nodeId)) {
    const n = graph.nodes.get(nodeId);
    if (n && typeof n.props?.path === "string") {
      return (n.props as { path: string }).path;
    }
    return filePathFromId(nodeId);
  }
  const n = graph.nodes.get(nodeId);
  if (n && n.type === "Symbol") {
    if (typeof n.props.module === "string") {
      return n.props.module as string;
    }
    if (typeof n.props.path === "string") {
      return n.props.path as string;
    }
  }
  return undefined;
}
