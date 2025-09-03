/**
 * @file Knowledge Graph engine: persist graph and support ops with explicit config.
 */
import type { KnowledgeGraphStore } from "./graph";
import { createKnowledgeGraphStore, knowledgeGraphFromJSON } from "./graph";
import { createIdRegistry } from "./id-registry";
import { rel } from "./util";
import type { Meta } from "./types";
import type { EmbedMany } from "../embedding";
import type { FileIO } from "vcdb/storage/types";

/**
 * Configuration for the knowledge-graph engine.
 * Callers must pass explicit directories to avoid hidden env coupling.
 */
export type KnowledgeGraphEngineConfig = {
  repoDir: string;
  /**
   * External storage adapter for persistence (rooted at desired base directory).
   * Callers should pass an IO instance (e.g., createNodeFileIO(dataDir)).
   */
  io: FileIO;
  indexBaseName?: string;
};

/** Engine API for loading/saving and maintaining the graph. */
export type KnowledgeGraphEngineApi = {
  load: () => Promise<void>;
  save: () => Promise<void>;
  getGraph: () => KnowledgeGraphStore;
  mergeGraph: (g: KnowledgeGraphStore) => void;
  deleteByPaths: (paths: string[]) => void;
  upsertEmbeddings: (args: {
    client: { upsert: (...items: { id: number; vector: number[]; meta: Meta }[]) => void } & Record<string, unknown>;
    items: { key: string; text: string; meta: Meta }[];
    embed: EmbedMany;
    batch?: number;
    persist?: (client: unknown, opts: { baseName: string }) => Promise<void> | void;
  }) => Promise<void>;
};

/**
 * Create a Knowledge Graph engine bound to a specific repository and data directory.
 *
 * - Persists a single graph JSON and an ID registry JSON cohesively.
 * - Exposes merge/delete operations that preserve node prop merges and edge integrity.
 * - Allows vector upsert via injected embedder and persistence callback.
 */
export function createKnowledgeGraphEngine(config: KnowledgeGraphEngineConfig): KnowledgeGraphEngineApi {
  if (!config || !config.repoDir || !config.io) {
    throw new Error("createKnowledgeGraphEngine: 'repoDir' and 'io' are required");
  }

  const graphPath = "graph.json";
  const idsPath = "ids.json";
  const baseName = config.indexBaseName ?? "knowledge-graph";
  const state: { graph: KnowledgeGraphStore } = { graph: createKnowledgeGraphStore() };
  const ids = createIdRegistry({ io: config.io, path: idsPath });

  async function load() {
    try {
      const buf = await config.io.read(graphPath);
      const j = JSON.parse(new TextDecoder().decode(buf));
      state.graph = knowledgeGraphFromJSON(j);
    } catch {
      // treat as empty graph when missing or unreadable
      state.graph = createKnowledgeGraphStore();
    }
    await ids.load();
  }

  async function save() {
    const data = new TextEncoder().encode(JSON.stringify(state.graph.toJSON(), null, 2));
    await config.io.atomicWrite(graphPath, data);
    await ids.save();
  }

  function getGraph() {
    return state.graph;
  }

  function mergeGraph(g: KnowledgeGraphStore) {
    for (const n of g.nodes.values()) {
      state.graph.upsertNode(n);
    }
    for (const e of g.edges) {
      state.graph.addEdge(e);
    }
  }

  function deleteByPaths(paths: string[]) {
    const set = new Set(paths.map((p) => `file://${rel(config.repoDir, p)}`));
    for (const id of [...state.graph.nodes.keys()]) {
      const n = state.graph.nodes.get(id)!;
      if (n.type === "File" && set.has(n.id)) {
        state.graph.removeNode(n.id);
      }
      if (n.type === "Symbol" && set.has(`file://${n.props.path}`)) {
        state.graph.removeNode(n.id);
      }
    }
  }

  async function upsertEmbeddings({
    client,
    items,
    embed,
    batch = 64,
    persist,
  }: {
    client: { upsert: (...items: { id: number; vector: number[]; meta: Meta }[]) => void } & Record<string, unknown>;
    items: { key: string; text: string; meta: Meta }[];
    embed: EmbedMany;
    batch?: number;
    persist?: (client: unknown, opts: { baseName: string }) => Promise<void> | void;
  }) {
    async function process(i: number): Promise<void> {
      if (i >= items.length) {
        return;
      }
      const chunk = items.slice(i, i + batch);
      const vecs = await embed(chunk.map((c) => c.text));
      const payload = chunk.map((c, j) => {
        const id = ids.idFor(c.key);
        const vec = vecs[j];
        if (!vec || vec.length === 0) {
          throw new Error(`No embedding for key=${c.key} (id=${id})`);
        }
        return { id, vector: [...vec], meta: c.meta };
      });
      client.upsert(...payload);
      await process(i + batch);
    }
    await process(0);
    if (persist) {
      await persist(client, { baseName });
    }
  }

  return { load, save, getGraph, mergeGraph, deleteByPaths, upsertEmbeddings };
}
