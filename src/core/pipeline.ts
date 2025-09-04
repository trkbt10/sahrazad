/**
 * @file Core ingestion pipeline: detect changes, run KGF, merge into KnowledgeGraph, upsert embeddings.
 */
import type { CoreIngestConfig } from "./types";
import { validateIngestConfig } from "./validate";
import { indexPathsWithKGF } from "./kgf-ingest";
import type { KGFSpec } from "../runtime/kgf";
import path from "node:path";
import { defaultTextForMeta } from "./utils";

/**
 * Create an ingest function bound to config. Caller supplies explicit dependencies.
 */
export function createIngestPipeline(config: CoreIngestConfig): {
  ingestPaths: (paths: string[], opts?: { save?: boolean; embed?: boolean }) => Promise<void>;
} {
  validateIngestConfig(config);
  const textFor = config.textForMeta ?? defaultTextForMeta;

  async function ingestPaths(paths: string[], opts?: { save?: boolean; embed?: boolean }): Promise<void> {
    const doSave = opts?.save ?? true;
    const doEmbed = opts?.embed ?? true;
    // Remove previous nodes/edges for target paths to avoid stale parseError and edges
    if (paths.length > 0) {
      config.engine.deleteByPaths(paths);
    }
    // Support single or multiple KGF specs: dispatch per file by extension/rules
    const specs = Array.isArray(config.kgfSpec) ? config.kgfSpec : [config.kgfSpec];

    function matchesSpec(spec: KGFSpec, fileAbs: string): boolean {
      const rel = path.relative(config.projectRoot, fileAbs).replace(/\\/g, "/");
      const ex = path.extname(rel);
      const srcs = spec.resolver.sources ?? [];
      const exts = spec.resolver.exts ?? [];
      if (srcs.length === 0 && exts.length === 0) { return true; }
      const arr = [...srcs, ...exts];
      for (const s of arr) {
        if (rel.endsWith(s) || ex === s) { return true; }
      }
      return false;
    }

    const groups = new Map<KGFSpec, string[]>();
    for (const p of paths) {
      const spec = specs.find((s) => matchesSpec(s, p));
      if (!spec) { continue; }
      const prev = groups.get(spec) ?? [];
      groups.set(spec, [...prev, p]);
    }

    for (const [spec, ps] of groups) {
      if (ps.length === 0) { continue; }
      const kgFrag = indexPathsWithKGF(spec, config.projectRoot, ps);
      config.engine.mergeGraph(kgFrag);
      // Embedding handled below per merged fragment via doEmbed branch
      if (doEmbed) {
        const items = Array.from(kgFrag.nodes.values()).map((n) => {
          if (n.type === "File") {
            const meta = { nodeId: n.id, kind: "file" as const, path: String(n.props.path ?? "") };
            return { key: n.id, text: textFor(meta), meta };
          }
          if (n.type === "Symbol") {
            const modulePath = typeof n.props.module === "string" ? (n.props.module as string) : undefined;
            const filePath = typeof n.props.path === "string" ? (n.props.path as string) : undefined;
            const symbolName = typeof n.props.name === "string" ? (n.props.name as string) : undefined;
            const meta = {
              nodeId: n.id,
              kind: "symbol" as const,
              path: filePath ?? modulePath ?? "",
              module: modulePath,
              symbol: symbolName,
            };
            return { key: n.id, text: textFor(meta), meta };
          }
          const meta = { nodeId: n.id, kind: "commit" as const };
          return { key: n.id, text: textFor(meta), meta };
        });

        await config.engine.upsertEmbeddings({
          client: config.vector.client,
          items,
          embed: config.embed,
          persist: config.vector.persist,
        });
      }
    }

    if (doSave) {
      await config.engine.save();
    }
  }

  return { ingestPaths };
}
