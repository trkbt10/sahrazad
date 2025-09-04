/**
 * @file Task assistance for MCP-like flows: suggest related files and build outlines.
 */
import type { KnowledgeGraphEngineApi } from "../services/knowledge-graph/engine";
import type { EmbedMany } from "../services/embedding";
import { nodeIdToFilePath } from "./utils";
import { toFileId } from "./domain/identifiers";

export type TaskAssistConfig = {
  engine: KnowledgeGraphEngineApi;
  embed: EmbedMany;
  client: { findMany: (q: Float32Array, opts: { k?: number }) => Promise<Array<{ id: number; score: number; meta: unknown }>> };
};

export type SuggestedFile = {
  path: string;
  score: number;
  reasons: string[];
};

export type TaskOutline = {
  files: { path: string; symbols: string[] }[];
  relations: { from: string; to: string; type: string }[];
  suggestedQueries: string[];
  nextFiles: string[];
  toText: () => string;
};

// nodeIdToFilePath moved to core/utils to ease testing and reuse

/**
 * Create task-assist API.
 */
export function createTaskAssist(cfg: TaskAssistConfig) {
  /** Suggest repo file paths related to a task string via vector hits → file mapping → neighbor expansion. */
  async function suggestRelatedFiles(args: { task: string; topKFiles: number; expandNeighbors?: boolean }): Promise<SuggestedFile[]> {
    if (!args || !args.task || args.topKFiles <= 0) {
      throw new Error("suggestRelatedFiles: 'task' and positive 'topKFiles' are required");
    }
    const [q] = await cfg.embed([args.task]);
    if (!q || q.length === 0) {
      throw new Error("suggestRelatedFiles: empty embedding for task");
    }
    // Pull more hits than requested files to allow aggregation
    const hits = await cfg.client.findMany(new Float32Array(q as number[]), { k: Math.max(args.topKFiles * 5, 20) });
    const acc = new Map<string, { score: number; reasons: string[] }>();
    const g = cfg.engine.getGraph();

    const add = (path: string, score: number, reason: string): void => {
      const got = acc.get(path);
      if (!got) {
        acc.set(path, { score, reasons: [reason] });
        return;
      }
      acc.set(path, { score: got.score + score, reasons: [...got.reasons, reason] });
    };

    for (const h of hits) {
      const meta = (h.meta ?? {}) as { nodeId?: string; kind?: string; path?: string; symbol?: string };
      const id = meta.nodeId;
      const baseScore = typeof h.score === "number" ? h.score : 0;
      if (!id) { continue; }
      const p = nodeIdToFilePath(cfg.engine.getGraph.bind(cfg.engine), id);
      if (p) {
        const label = meta.kind === "symbol" && meta.symbol ? `symbol ${meta.symbol}` : meta.kind ?? "node";
        add(p, baseScore, `vector match on ${label}`);
      }
      if (args.expandNeighbors !== false) {
        // expand one hop to file nodes
        const neigh = g.neighbors(id, "both");
        for (const e of neigh) {
          const np = nodeIdToFilePath(cfg.engine.getGraph.bind(cfg.engine), e.from) ?? nodeIdToFilePath(cfg.engine.getGraph.bind(cfg.engine), e.to);
          if (np) {
            add(np, baseScore * 0.5, `neighbor via ${e.type}`);
          }
        }
      }
    }

    const ranked = [...acc.entries()]
      .map<SuggestedFile>(([path, v]) => ({ path, score: v.score, reasons: v.reasons }))
      .sort((a, b) => b.score - a.score)
      .slice(0, args.topKFiles);
    return ranked;
  }

  /** Build a lightweight outline to refine the task: key symbols, relations, and next-file candidates. */
  function buildTaskOutline(args: { files: readonly string[]; maxSymbolsPerFile?: number }): TaskOutline {
    const g = cfg.engine.getGraph();
    const filesSet = new Set(args.files);
    const perFileSymbols: { path: string; symbols: string[] }[] = [];
    for (const f of args.files) {
      const fid = toFileId(f);
      const neigh = g.neighbors(fid, "out");
      const syms = neigh
        .filter((e) => e.type === "CONTAINS")
        .map((e) => g.nodes.get(e.to))
        .filter((n): n is Exclude<typeof n, undefined> => !!n && n.type === "Symbol")
        .map((n) => (typeof n.props.name === "string" ? n.props.name : String(n.id)))
        .slice(0, Math.max(args.maxSymbolsPerFile ?? 12, 1));
      perFileSymbols.push({ path: f, symbols: syms });
    }

    const rels: { from: string; to: string; type: string }[] = [];
    for (const e of g.edges) {
      const fromPath = nodeIdToFilePath(cfg.engine.getGraph.bind(cfg.engine), e.from);
      const toPath = nodeIdToFilePath(cfg.engine.getGraph.bind(cfg.engine), e.to);
      if (!fromPath || !toPath) {
        continue;
      }
      if (!filesSet.has(fromPath)) {
        continue;
      }
      if (!filesSet.has(toPath)) {
        continue;
      }
      rels.push({ from: fromPath, to: toPath, type: String(e.type) });
    }

    // Suggest next files: neighbors one hop away not in the selection
    const nextFilesAcc = new Map<string, number>();
    for (const f of args.files) {
      const fid = toFileId(f);
      for (const e of g.neighbors(fid, "both")) {
        const np = nodeIdToFilePath(cfg.engine.getGraph.bind(cfg.engine), e.from) ?? nodeIdToFilePath(cfg.engine.getGraph.bind(cfg.engine), e.to);
        if (np && !filesSet.has(np)) {
          nextFilesAcc.set(np, (nextFilesAcc.get(np) ?? 0) + 1);
        }
      }
    }
    const nextFiles = [...nextFilesAcc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map((e) => e[0]);

    const suggestedQueries = perFileSymbols
      .flatMap((f) => f.symbols.slice(0, 3).map((s) => `${s} in ${f.path}`))
      .slice(0, 10);

    const toText = () => {
      const lines: string[] = [];
      lines.push("Task Outline");
      lines.push("");
      lines.push("Files:");
      for (const f of perFileSymbols) {
        lines.push(`- ${f.path}: ${f.symbols.join(", ")}`);
      }
      lines.push("");
      lines.push("Relations:");
      for (const r of rels) {
        lines.push(`- ${r.from} ${r.type} ${r.to}`);
      }
      lines.push("");
      lines.push("Next files:");
      for (const nf of nextFiles) {
        lines.push(`- ${nf}`);
      }
      lines.push("");
      lines.push("Suggested queries:");
      for (const q of suggestedQueries) {
        lines.push(`- ${q}`);
      }
      return lines.join("\n");
    };

    return { files: perFileSymbols, relations: rels, suggestedQueries, nextFiles, toText };
  }

  return { suggestRelatedFiles, buildTaskOutline };
}
