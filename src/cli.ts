/**
 * @file CLI entry to start the server and (optionally) register MCP tools.
 */
import { parseArgv } from "./runtime/args";
import OpenAI from "openai";
import { createActionsFromCore } from "./index";
import type { Meta } from "./services/knowledge-graph/types";
import { createKnowledgeGraphEngine } from "./services/knowledge-graph/engine";
import { createDefaultItems } from "./runtime/serve/default-spec";
import { ensureServerSpec, startRestFromSpec } from "./runtime/serve";
import type { EmbedMany } from "./services/embedding";
import { createCustomEmbedder } from "./services/embedding";
import { createXenovaEmbedder } from "./services/embedding";
import * as Transformers from "@xenova/transformers";
import { createNodeFileIO } from "vcdb/storage/node";
import { connect, type VectorDB } from "vcdb";
import { parseKGF } from "./runtime/kgf/spec";
import type { KGFSpec } from "./runtime/kgf";
import type { AppConfig } from "./config/schema";
import { loadEffectiveConfig } from "./config/load";

const spec = {
  provider: { type: "string", default: "xenova" },
  model: { type: "string" },
  dir: { type: "string[]", default: [process.cwd()] },
  port: { type: "number", default: 8787 },
  restful: { type: "boolean", default: true },
  mcp: { type: "boolean", default: false },
  basePath: { type: "string", default: "/api" },
  dim: { type: "number" },
  index: { type: "boolean", default: false },
  force: { type: "boolean", default: false },
  search: { type: "string", default: "" },
  k: { type: "number", default: 10 },
  excludes: { type: "string[]", default: [".git/", "node_modules/", "dist/", "build/", "coverage/", ".kg/", ".vcdb/"] },
  includes: { type: "string[]", default: [] },
  watchFs: { type: "boolean", default: false },
  watchGit: { type: "boolean", default: false },
  debounceMs: { type: "number", default: 200 },
  kgf: { type: "string", default: "" },
  verbose: { type: "boolean", default: false },
} as const;

// Snapshot utilities for diff-based indexing
type Snapshot = { files: Array<{ path: string; mtimeMs: number; size: number }> };

import { statSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join as joinPath, isAbsolute as isAbsPath, relative as relPath, resolve as resolvePath } from "node:path";
import { shouldIgnore, shouldInclude } from "./core/domain/ignore";
import { startFsWatch, startGitWatch } from "./core/watchers";
import { createGitRepo } from "./runtime/git";

function collectFiles(root: string, inputs: string[], excludes: string[], includes: string[]): string[] {
  const out: string[] = [];
  function walk(abs: string): void {
    const st = statSync(abs);
    if (st.isDirectory()) {
      for (const fn of readdirSync(abs)) {
        walk(joinPath(abs, fn));
      }
      return;
    }
    if (st.isFile()) {
      const rel = relPath(root, abs).replaceAll("\\", "/");
      if (shouldIgnore(rel, excludes)) { return; }
      if (!shouldInclude(rel, includes)) { return; }
      out.push(abs);
    }
  }
  for (const p of inputs) {
    const abs = isAbsPath(p) ? p : joinPath(root, p);
    if (!existsSync(abs)) { continue; }
    walk(abs);
  }
  return out;
}

function readSnapshot(path: string): Snapshot | null {
  if (!existsSync(path)) { return null; }
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    if (!j || typeof j !== "object" || !Array.isArray((j as { files?: unknown }).files)) { return null; }
    const files = (j as { files: Array<{ path: string; mtimeMs: number; size: number }> }).files;
    return { files };
  } catch {
    return null;
  }
}

function buildSnapshot(root: string, files: string[]): Snapshot {
  const arr = files.map((abs) => {
    const st = statSync(abs);
    const rel = relPath(root, abs).replaceAll("\\", "/");
    return { path: rel, mtimeMs: st.mtimeMs, size: st.size };
  });
  return { files: arr };
}

function diffSnapshots(prev: Snapshot | null, next: Snapshot) {
  const prevMap: Record<string, { mtimeMs: number; size: number }> = {};
  if (prev !== null) {
    for (const f of prev.files) { prevMap[f.path] = { mtimeMs: f.mtimeMs, size: f.size }; }
  }
  const nextMap: Record<string, { mtimeMs: number; size: number }> = {};
  for (const f of next.files) { nextMap[f.path] = { mtimeMs: f.mtimeMs, size: f.size }; }
  const removed: string[] = [];
  const added: string[] = [];
  const modified: string[] = [];
  for (const k of Object.keys(prevMap)) {
    if (!(k in nextMap)) { removed.push(k); }
  }
  for (const k of Object.keys(nextMap)) {
    if (!(k in prevMap)) { added.push(k); continue; }
    const a = prevMap[k];
    const b = nextMap[k];
    if (a.mtimeMs !== b.mtimeMs || a.size !== b.size) { modified.push(k); }
  }
  return { removed, added, modified };
}

async function resolveEmbedder(opts: { provider: string; model: string }): Promise<EmbedMany> {
  if (opts.provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) { throw new Error("OPENAI_API_KEY is required for provider=openai"); }
    const client = new OpenAI({ apiKey });
    const embedMany: EmbedMany = async (inputs) => {
      const arr = Array.from(inputs);
      const res = await client.embeddings.create({ model: opts.model, input: arr });
      return res.data.map((d) => d.embedding);
    };
    return embedMany;
  }
  if (opts.provider === "xenova") {
    const embedMany: EmbedMany = createXenovaEmbedder({
      model: opts.model,
      importer: async () => ({ pipeline: Transformers.pipeline }),
      // keep defaults: quantized, mean pooling, normalized
    });
    return embedMany;
  }
  if (opts.provider === "custom") {
    // Minimal custom embedder placeholder: throws until user implements.
    return createCustomEmbedder({ embedMany: async () => { throw new Error("custom embedder: implement your embedder and pass via provider=custom in code"); } });
  }
  throw new Error(`Unknown provider: ${opts.provider}`);
}

async function main(argv: string[]): Promise<void> {
  const args = parseArgv(argv, spec);
  const effective: AppConfig = loadEffectiveConfig(process.cwd(), argv, args as Record<string, unknown>);
  const rawDir = String((effective.dir && effective.dir[0]) ? effective.dir[0] : process.cwd());
  const repoDir = resolvePath(rawDir);
  const dataRoot = `${repoDir}/.kg`;
  const io = createNodeFileIO(`${dataRoot}`);
  // Use a distinct base name for vector index
  const engine = createKnowledgeGraphEngine({ repoDir, io, indexBaseName: "vectors" });
  await engine.load();

  // Resolve model/dim from args or environment, no silent defaults
  const resolvedModel = String((effective.model && effective.model.length > 0) ? effective.model : (process.env.EMBED_MODEL ?? ""));
  const resolvedDim = Number((effective.dim && effective.dim > 0) ? effective.dim : (process.env.EMBED_DIM ?? NaN));
  if (!resolvedModel || resolvedModel.length === 0) {
    throw new Error("EMBED_MODEL is required (set via .env or --model)");
  }
  if (!Number.isFinite(resolvedDim) || resolvedDim <= 0) {
    throw new Error("EMBED_DIM is required and must be > 0 (set via .env or --dim)");
  }
  if (args.verbose === true) {
    console.log(`[embed] provider=${String(args.provider)} model=${resolvedModel} dim=${String(resolvedDim)}`);
  }

  const embed = await resolveEmbedder({ provider: String(effective.provider ?? "xenova"), model: resolvedModel });

  // Resolve KGF spec (optional)
  const kgfPath = typeof effective.kgf === "string" ? effective.kgf : "";
  const kgfSpec: KGFSpec = (() => {
    if (kgfPath && kgfPath.length > 0) {
      const abs = isAbsPath(kgfPath) ? kgfPath : joinPath(repoDir, kgfPath);
      if (!existsSync(abs)) {
        throw new Error(`kgf file not found: ${abs}`);
      }
      const text = readFileSync(abs, "utf8");
      const spec = parseKGF(text);
      if (args.verbose === true) {
        console.log(`[kgf] loaded: ${abs} language=${spec.language}`);
      }
      return spec;
    }
    return { language: "typescript", tokens: [], rules: {}, attrs: {}, resolver: { sources: [], relative_prefixes: [], exts: [], indexes: [], bare_prefix: "", module_path_style: "slash", aliases: [], ns_segments: 2, rust_mod_mode: false, cargo_auto_from_roots: [] } } as KGFSpec;
  })();

  // Normalize include/exclude patterns once for both indexing and recall
  type LocalConfig = { includes?: string[]; excludes?: string[] };
  function loadLocalConfig(baseDir: string): LocalConfig {
    try {
      const p = joinPath(baseDir, "shrzad.config.json");
      if (!existsSync(p)) { return {}; }
      const text = readFileSync(p, "utf8");
      const j = JSON.parse(text) as { includes?: unknown; excludes?: unknown };
      const inc = Array.isArray(j.includes) ? j.includes.filter((x): x is string => typeof x === "string") : [];
      const exc = Array.isArray(j.excludes) ? j.excludes.filter((x): x is string => typeof x === "string") : [];
      return { includes: inc, excludes: exc };
    } catch {
      return {};
    }
  }
  const cfg = loadLocalConfig(repoDir);
  const effectiveExcludes = Array.isArray(effective.excludes) ? effective.excludes : (cfg.excludes ?? []);
  const effectiveIncludes = Array.isArray(effective.includes) ? effective.includes : (cfg.includes ?? []);
  const ignorePatterns = Array.from(new Set(effectiveExcludes));
  const includePatterns = Array.from(new Set(effectiveIncludes));

  // Preset KGF loader and inference
  function inferPresetFor(rel: string): string | undefined {
    if (rel.endsWith(".ts") || rel.endsWith(".tsx")) {
      return "typescript";
    }
    if (rel.endsWith(".js")) { return "javascript"; }
    if (rel.endsWith(".jsx")) { return "javascript"; }
    if (rel.endsWith(".mjs")) { return "javascript"; }
    if (rel.endsWith(".cjs")) { return "javascript"; }
    if (rel.endsWith(".html")) { return "html"; }
    if (rel.endsWith(".htm")) { return "html"; }
    if (rel.endsWith(".md")) { return "markdown"; }
    if (rel.endsWith(".markdown")) { return "markdown"; }
    if (rel.endsWith(".css")) { return "css"; }
    if (rel.endsWith(".py")) {
      return "python";
    }
    if (rel.endsWith(".rel")) { return "reltext"; }
    if (rel.endsWith(".reltext")) { return "reltext"; }
    return undefined;
  }

  function loadPreset(name: string): KGFSpec {
    const presetRoot = joinPath(process.cwd(), "src/runtime/kgf/__fixtures__/specs");
    const p = joinPath(presetRoot, `${name}.kgf`);
    if (!existsSync(p)) {
      throw new Error(`preset kgf not found: ${p}`);
    }
    const text = readFileSync(p, "utf8");
    const spec = parseKGF(text);
    return spec;
  }
  // VectorDB wiring: persistent local store under .vcdb
  const vcdbRoot = `${repoDir}/.vcdb`;
  const vectorDb: VectorDB<Meta> = await connect<Meta>({
    storage: {
      index: createNodeFileIO(`${vcdbRoot}/index`),
      data: createNodeFileIO(`${vcdbRoot}/data`),
    },
    database: { dim: resolvedDim, metric: "cosine", strategy: "bruteforce" },
    index: { name: "vectors", segmented: true },
  });

  // Adapter: buffer upserts synchronously; flush in persist()
  const buffer: Array<{ id: number; vector: Float32Array; meta: Meta }> = [];
  const counters = { staged: 0 };
  // Buffer to batch upserts before snapshot; recall/search uses vectorDb directly.
  const actions = createActionsFromCore({
    repoDir,
    projectRoot: repoDir,
    kgfSpec,
    engine,
    embed,
    vector: {
      client: {
        async upsert(...rows: { id: number; vector: Float32Array; meta: Meta }[]) { return vectorDb.upsert(...rows); },
        async findMany(q: Float32Array, opts: { k?: number }) { return vectorDb.findMany(q, { k: opts.k }); },
      },
      persist: async () => {
        const pending = buffer.length;
        if (args.verbose === true) {
          console.log(`[vector] pending_upserts=${String(pending)} staged_total=${String(counters.staged)}`);
        }
        if (pending > 0) {
          const rows = buffer.splice(0, pending).map((r) => ({ id: r.id, vector: r.vector, meta: r.meta }));
          await vectorDb.upsert(...rows);
          if (args.verbose === true) {
            console.log(`[vector] upserted=${String(rows.length)}`);
          }
        }
        await vectorDb.index.saveState(vectorDb.state, { baseName: "vectors" });
        if (args.verbose === true) {
          console.log("[vector] saved snapshot");
        }
      },
    },
    excludes: ignorePatterns,
  });

  // One-shot search: embed and query, then exit
  const searchText = String(args.search ?? "");
  if (searchText.length > 0) {
    const results = await actions.recall({ text: searchText, topK: Number(args.k) });
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // One-shot indexing with diff-based skip
  const doIndex = args.index === true;
  if (doIndex) {
    const snapshotPath = joinPath(dataRoot, "snapshot.json");
    const prev = readSnapshot(snapshotPath);
    const files = collectFiles(repoDir, [repoDir], ignorePatterns, includePatterns);
    const next = buildSnapshot(repoDir, files);
    const { removed, added, modified } = diffSnapshots(prev, next);
    if (args.verbose === true) {
      const prevState = prev === null ? "none" : "exists";
      console.log(`[index] snapshot_prev=${prevState} added=${String(added.length)} modified=${String(modified.length)} removed=${String(removed.length)}`);
    }

    if (!(args.force === true) && prev !== null && removed.length === 0 && added.length === 0 && modified.length === 0) {
      console.log("No changes detected since last snapshot. Skipping indexing.");
      return;
    }

    if (removed.length > 0) {
      const absPaths = removed.map((p) => joinPath(repoDir, p));
      engine.deleteByPaths(absPaths);
      await engine.save();
      console.warn("Warning: Deleted files removed from graph, but vectors are not pruned.");
    }

    // Proactively drop any previously indexed nodes that match ignore patterns (e.g., .git/*)
    const gNow = engine.getGraph();
    const toDrop: string[] = [];
    for (const n of gNow.nodes.values()) {
      if (n.type === "File") {
        const p = typeof n.props.path === "string" ? (n.props.path as string) : "";
        if (p && shouldIgnore(p, ignorePatterns)) {
          toDrop.push(joinPath(repoDir, p));
        }
      }
    }
    if (toDrop.length > 0) {
      engine.deleteByPaths(toDrop);
      await engine.save();
      if (args.verbose === true) {
        console.log(`[index] dropped_ignored=${String(toDrop.length)}`);
      }
    }

    const toIngest = Array.from(new Set([...added, ...modified]));
    const shouldIndex = args.force === true ? true : (toIngest.length > 0 ? true : prev === null);
    if (shouldIndex) {
      const useFullRepo = args.force === true ? true : (prev === null ? true : false);
      const paths = useFullRepo ? files : toIngest.map((p) => joinPath(repoDir, p));
      if (args.verbose === true) {
        const mode = useFullRepo ? "full" : "partial";
        const count = paths.length;
        const beforeNodes = engine.getGraph().nodes.size;
        console.log(`[index] mode=${mode} paths=${String(count)} nodes_before=${String(beforeNodes)}`);
      }
      if (kgfPath && kgfPath.length > 0) {
        await actions.ingestPaths({ paths, save: true, embed: true });
      } else {
        // Auto-group by preset and ingest per group
        const groups: Record<string, string[]> = {};
        for (const abs of paths) {
          const rel = relPath(repoDir, abs).replace(/\\/g, "/");
          const name = inferPresetFor(rel);
          if (!name) { continue; }
          const arr = groups[name] ?? [];
          groups[name] = [...arr, abs];
        }
        for (const [name, groupPaths] of Object.entries(groups)) {
          const spec = loadPreset(name);
          const groupActions = createActionsFromCore({ repoDir, projectRoot: repoDir, kgfSpec: spec, engine, embed, vector: { client: { async upsert(...rows: { id: number; vector: Float32Array; meta: Meta }[]) { return vectorDb.upsert(...rows); }, async findMany(q: Float32Array, opts: { k?: number }) { return vectorDb.findMany(q, { k: opts.k }); }, }, persist: async () => { /* persist handled globally */ } }, excludes: ignorePatterns });
          if (args.verbose === true) {
            console.log(`[index] ingest group preset=${name} files=${String(groupPaths.length)}`);
          }
          await groupActions.ingestPaths({ paths: groupPaths, save: true, embed: true });
        }
      }
      if (args.verbose === true) {
        const afterNodes = engine.getGraph().nodes.size;
        console.log(`[index] nodes_after=${String(afterNodes)}`);
      }
    }
    writeFileSync(snapshotPath, JSON.stringify(next, null, 2));
    console.log("Indexing complete. Snapshot updated.");
    return;
  }

  // Optional watchers: FS and/or Git
  const watchFs = args.watchFs === true;
  const watchGit = args.watchGit === true;
  if (watchFs || watchGit) {
    const onPathsChanged = async (changedAbs: string[]): Promise<void> => {
      const rels = changedAbs.map((p) => relPath(repoDir, p).replace(/\\/g, "/"));
      const filtered = rels.filter((p) => {
        if (shouldIgnore(p, ignorePatterns)) { return false; }
        if (!shouldInclude(p, includePatterns)) { return false; }
        return true;
      });
      if (filtered.length === 0) {
        if (args.verbose === true) { console.log("[watch] no changes after ignore"); }
        return;
      }
      const inputs = filtered.map((r) => joinPath(repoDir, r));
      if (kgfPath && kgfPath.length > 0) {
        if (args.verbose === true) { console.log(`[watch] ingest ${String(inputs.length)} files`); }
        await actions.ingestPaths({ paths: inputs, save: true, embed: true });
        return;
      }
      // Group by preset and ingest per group
      const groups: Record<string, string[]> = {};
      for (const abs of inputs) {
        const rel = relPath(repoDir, abs).replace(/\\/g, "/");
        const name = inferPresetFor(rel);
        if (!name) { continue; }
        const arr = groups[name] ?? [];
        groups[name] = [...arr, abs];
      }
      for (const [name, groupPaths] of Object.entries(groups)) {
        const spec = loadPreset(name);
        const groupActions = createActionsFromCore({ repoDir, projectRoot: repoDir, kgfSpec: spec, engine, embed, vector: { client: { async upsert(...rows: { id: number; vector: Float32Array; meta: Meta }[]) { return vectorDb.upsert(...rows); }, async findMany(q: Float32Array, opts: { k?: number }) { return vectorDb.findMany(q, { k: opts.k }); }, }, persist: async () => { /* no-op */ } }, excludes: ignorePatterns });
        if (args.verbose === true) {
          console.log(`[watch] ingest group preset=${name} files=${String(groupPaths.length)}`);
        }
        await groupActions.ingestPaths({ paths: groupPaths, save: true, embed: true });
      }
    };

    const closers: Array<() => Promise<void> | void> = [];
    if (watchFs) {
      const closeFs = await startFsWatch({ paths: [repoDir], debounceMs: Number(args.debounceMs), onChange: onPathsChanged });
      closers.push(closeFs);
      if (args.verbose === true) { console.log(`[watch] fs watching ${repoDir}`); }
    }
    if (watchGit) {
      const repo = createGitRepo(repoDir);
      const stopGit = startGitWatch(repo, [repoDir], {}, onPathsChanged);
      closers.push(stopGit);
      if (args.verbose === true) { console.log(`[watch] git watching ${repoDir}`); }
    }
    process.on("SIGINT", async () => {
      for (const c of closers) { await c(); }
      process.exit(0);
    });
    // Keep process alive if server not started
    if (!args.restful) {
      await new Promise<void>((resolve) => {
        process.once("SIGTERM", () => resolve());
        process.once("SIGINT", () => resolve());
      });
    }
  }

  const items = createDefaultItems();
  const serverSpec = ensureServerSpec({ items }, { features: { restful: Boolean(args.restful) }, restful: { basePath: String(args.basePath) } });

  if (args.restful) {
    startRestFromSpec(serverSpec, actions, { port: Number(args.port) });
    console.log(`REST listening on http://localhost:${Number(args.port)}`);
  }
  if (args.mcp) {
    // Placeholder: require host MCP adapter; here we just print registered tool names.
    console.log(`MCP tools available: ${items.map((i) => i.type === "tool" ? i.name : i.type).join(", ")}`);
  }
}

// Execute when run via bun/node
if (import.meta.main) {
  // slice(2) to skip node/bun and script path
  main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
