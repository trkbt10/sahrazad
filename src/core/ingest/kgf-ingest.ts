/**
 * @file KGF -> KnowledgeGraph conversion helpers and indexing glue.
 */
import { createTool, type CodeGraph } from "../../runtime/kgf/index";
import type { KGFSpec } from "../../runtime/kgf/index";
import { createKnowledgeGraphStore } from "../../services/knowledge-graph/graph";
import type { KnowledgeGraphStore } from "../../services/knowledge-graph/graph";

import { toFileId, toSymbolId } from "../domain/identifiers";
const fileUri = (relPath: string): string => toFileId(relPath);
const symbolUri = (kgfId: string): string => toSymbolId(kgfId);

/** Map KGF edge kind to KnowledgeGraph edge type, preserving original in props.kind. */
function mapEdgeKind(kind: string): { type: "CONTAINS" | "IMPORTS" | "CALLS" | "DEFINED_IN"; kindProp?: string } {
  const k = kind.toLowerCase();
  if (k === "imports" || k === "import") {
    return { type: "IMPORTS", kindProp: kind };
  }
  if (k === "calls" || k === "call") {
    return { type: "CALLS", kindProp: kind };
  }
  if (k === "declares" || k === "defines" || k === "decl" || k === "define") {
    return { type: "CONTAINS", kindProp: kind };
  }
  return { type: "CONTAINS", kindProp: kind };
}

/**
 * Convert a KGF CodeGraph into a partial KnowledgeGraphStore that can be merged.
 */
export function toKnowledgeGraph(kg: CodeGraph): KnowledgeGraphStore {
  const g = createKnowledgeGraphStore();
  for (const [mid, mod] of Object.entries(kg.modules)) {
    const id = fileUri(mid);
    g.upsertNode({ id, type: "File", props: { path: mod.file ?? mid } });
  }
  for (const [sid, s] of Object.entries(kg.symbols)) {
    const id = symbolUri(sid);
    g.upsertNode({
      id,
      type: "Symbol",
      props: { name: s.name, kind: s.kind, ns: s.ns, path: s.module, module: s.module },
    });
  }
  const moduleIds = new Set(Object.keys(kg.modules));
  const symbolIds = new Set(Object.keys(kg.symbols));
  for (const e of kg.edges) {
    const src = moduleIds.has(e.from) ? fileUri(e.from) : symbolIds.has(e.from) ? symbolUri(e.from) : symbolUri(e.from);
    const dst = moduleIds.has(e.to) ? fileUri(e.to) : symbolIds.has(e.to) ? symbolUri(e.to) : symbolUri(e.to);
    const mapped = mapEdgeKind(e.kind);
    g.addEdge({
      from: src,
      to: dst,
      type: mapped.type,
      props: { ...(e.attrs ?? {}), kind: mapped.kindProp ?? e.kind },
    });
  }
  return g;
}

/**
 * Index the given paths using a KGF spec and return a KnowledgeGraphStore fragment.
 */
export function indexPathsWithKGF(spec: KGFSpec, projectRoot: string, paths: string[]): KnowledgeGraphStore {
  const tool = createTool(spec, projectRoot);
  const codeGraph = tool.indexPaths(paths);
  return toKnowledgeGraph(codeGraph);
}
