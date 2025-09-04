/**
 * @file Application entry: wire schema + core + serve to build runnable servers.
 *
 * Note:
 * - This module does not start processes by itself; actual boot lives in src/http.ts or src/cli.tsx.
 * - Callers inject explicit dependencies (no env access) and a ServerSpec to produce apps/tools.
 */

// Core (domain logic)
import type { CoreIngestConfig } from "./core/types";
import { createIngestPipeline } from "./core/pipeline";
import { createRecallQueryApi } from "./core/query";
import { createTaskAssist } from "./core/task-assist";
import { validateVectorClient } from "./core/validate";

// Serve runtime (schema-driven)
import type { ActionRegistry } from "./runtime/serve";
import { defineJsonAction } from "./runtime/serve";
import type { JSONSchemaType } from "ajv";
import type { ServerSpec } from "./runtime/serve";
import { buildHttpHandlerFromSpec } from "./runtime/serve";
import type { HttpApp } from "./runtime/serve";
import type { McpOfficialAdapter } from "./runtime/serve";
import { registerMcpToolsOn } from "./runtime/serve";

export type { Embedding, EmbedMany } from "./services/embedding";
export type { ServerSpec } from "./runtime/serve";
export type { ActionRegistry } from "./runtime/serve";

export type AppCoreDeps = CoreIngestConfig;

// Vector search adapter no longer needed; we pass vcdb directly.

/**
 * Build an ActionRegistry from core dependencies.
 *
 * - ingestPaths: KGF→KG merge + optional embed upsert via engine pipeline
 * - recall: vector recall with graph neighbors
 * - task.suggest: file suggestions for task text
 * - task.outline: outline with symbols/relations/next-files/suggested queries
 */
export function createActionsFromCore(deps: AppCoreDeps): ActionRegistry {
  validateVectorClient(deps?.vector?.client);
  const pipeline = createIngestPipeline(deps);
  const recall = createRecallQueryApi({ engine: deps.engine, embed: deps.embed, client: deps.vector.client, ignore: deps.excludes });
  const task = createTaskAssist({ engine: deps.engine, embed: deps.embed, client: { findMany: deps.vector.client.findMany } });

  type IngestArgs = { paths?: string[]; save?: boolean; embed?: boolean };
  const IngestSchema: JSONSchemaType<IngestArgs> = {
    type: "object",
    properties: {
      paths: { type: "array", items: { type: "string" }, nullable: true, default: [] },
      save: { type: "boolean", nullable: true, default: true },
      embed: { type: "boolean", nullable: true, default: true },
    },
    required: [],
    additionalProperties: false,
  };

  type RecallArgs = { text?: string; topK?: number; dir?: "out" | "in" | "both"; scopeDir?: string };
  const RecallSchema: JSONSchemaType<RecallArgs> = {
    type: "object",
    properties: {
      text: { type: "string", nullable: true, default: "" },
      topK: { type: "number", nullable: true, default: 10 },
      dir: { type: "string", enum: ["out", "in", "both"], nullable: true },
      scopeDir: { type: "string", nullable: true },
    },
    required: [],
    additionalProperties: false,
  };

  type SuggestArgs = { task?: string; topKFiles?: number; expandNeighbors?: boolean };
  const SuggestSchema: JSONSchemaType<SuggestArgs> = {
    type: "object",
    properties: {
      task: { type: "string", nullable: true, default: "" },
      topKFiles: { type: "number", nullable: true, default: 10 },
      expandNeighbors: { type: "boolean", nullable: true, default: true },
    },
    required: [],
    additionalProperties: false,
  };

  type OutlineArgs = { files?: string[]; maxSymbolsPerFile?: number };
  const OutlineSchema: JSONSchemaType<OutlineArgs> = {
    type: "object",
    properties: {
      files: { type: "array", items: { type: "string" }, nullable: true, default: [] },
      maxSymbolsPerFile: { type: "number", nullable: true },
    },
    required: [],
    additionalProperties: false,
  };

  const actions: ActionRegistry = {
    ingestPaths: defineJsonAction<IngestArgs>(IngestSchema, async (p) => {
      await pipeline.ingestPaths(p.paths ?? [], { save: p.save ?? true, embed: p.embed ?? true });
      return { ok: true } as Record<string, unknown>;
    }),
    recall: defineJsonAction<RecallArgs>(RecallSchema, async (p) => {
      const dir = p.dir ? { dir: p.dir } : undefined;
      const results = await recall.recall({ text: p.text ?? "", topK: p.topK ?? 10, includeNeighbors: dir, scopeDir: p.scopeDir ?? undefined });
      return { results } as Record<string, unknown>;
    }),
    "task.suggest": defineJsonAction<SuggestArgs>(SuggestSchema, async (p) => {
      const files = await task.suggestRelatedFiles({ task: p.task ?? "", topKFiles: p.topKFiles ?? 10, expandNeighbors: p.expandNeighbors ?? true });
      return { files } as Record<string, unknown>;
    }),
    "task.outline": defineJsonAction<OutlineArgs>(OutlineSchema, async (p) => {
      const outline = task.buildTaskOutline({ files: p.files ?? [], maxSymbolsPerFile: p.maxSymbolsPerFile });
      return { outline: { files: outline.files, relations: outline.relations, suggestedQueries: outline.suggestedQueries, nextFiles: outline.nextFiles, text: outline.toText() } } as Record<string, unknown>;
    }),
    // Lightweight path-based browsing (no explicit Dir nodes): returns immediate children under base
    browse: defineJsonAction<{ base?: string }>({ type: "object", properties: { base: { type: "string", nullable: true, default: "" } }, required: [], additionalProperties: true } as JSONSchemaType<{ base?: string }>, async (p) => {
      const base = typeof p.base === "string" ? p.base : "";
      const g = deps.engine.getGraph();
      const dirs = new Set<string>();
      const files: string[] = [];
      for (const n of g.nodes.values()) {
        if (n.type !== "File") { continue; }
        const path = typeof n.props.path === "string" ? (n.props.path as string) : "";
        if (!path) { continue; }
        if (base) {
          if (!path.startsWith(base)) { continue; }
        }
        const rest = base ? path.slice(base.length) : path;
        const parts = rest.split("/");
        const seg = parts[0] ? parts[0] : rest;
        const hasMore = parts.length > 1;
        if (hasMore) { dirs.add(seg); } else { files.push(rest); }
      }
      return { base, dirs: Array.from(dirs).sort(), files: files.sort() } as Record<string, unknown>;
    }),
  };

  return actions;
}

/**
 * Build an HTTP app (fetch handler) from a ServerSpec using core dependencies.
 */
export function buildHttpApp(spec: ServerSpec, deps: AppCoreDeps): HttpApp {
  const actions = createActionsFromCore(deps);
  return buildHttpHandlerFromSpec(spec, actions);
}

/**
 * Register MCP items on an official adapter from a ServerSpec using core dependencies.
 */
export function registerMcp(spec: ServerSpec, adapter: McpOfficialAdapter, deps: AppCoreDeps): void {
  const actions = createActionsFromCore(deps);
  registerMcpToolsOn(adapter, spec, actions);
}
