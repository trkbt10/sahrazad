/**
 * @file Core types for recall framework orchestration.
 */
import type { KGFSpec } from "../runtime/kgf";
import type { KnowledgeGraphEngineApi } from "../services/knowledge-graph/engine";
import type { EmbedMany } from "../services/embedding";
import type { Meta } from "../services/knowledge-graph/types";
import type { VectorDB } from "vcdb";

export type CoreIngestConfig = {
  repoDir: string;
  projectRoot: string;
  kgfSpec: KGFSpec | KGFSpec[];
  engine: KnowledgeGraphEngineApi;
  embed: EmbedMany;
  vector: { db: VectorDB<Meta> };
  /** Optional recall-time exclude patterns (repo-relative). */
  excludes?: string[];
  /**
   * Optional text builder to generate embedding text per node.
   * If omitted, a minimal default will be used.
   */
  textForMeta?: (meta: Meta) => string;
};

export type StartFsWatchArgs = {
  paths: readonly string[];
  debounceMs?: number;
  onChange: (paths: string[]) => Promise<void>;
};

export type RecallQueryArgs = {
  text: string;
  topK: number;
  includeNeighbors?: { dir?: "out" | "in" | "both" };
  /** Optional: restrict hits to files under this directory (repo-relative, POSIX style). */
  scopeDir?: string;
};
