/**
 * @file High-level tool that indexes files according to a KGF spec and produces a graph.
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { buildLexer } from "./lexer";
import { buildPEG, runParse } from "./peg";
import type { CodeGraph } from "./graph";
import { addEdge, createGraph, getOrAddModule } from "./graph";
import type { KGFSpec } from "./types";

/** Create an indexer tool bound to a project root for a given KGF spec. */
export function createTool(spec: KGFSpec, projectRoot: string): {
  graph: CodeGraph;
  indexPaths: (paths: string[]) => CodeGraph;
} {
  const root = projectRoot;
  const graph = createGraph();
  const peg = buildPEG(spec);
  const lex = buildLexer(spec.tokens);

  const isSrc = (filename: string): boolean => {
    if (!spec.resolver.sources || spec.resolver.sources.length === 0) {
      return true;
    }
    return spec.resolver.sources.some((ext) => filename.endsWith(ext));
  };

  const collectFiles = (input: string): string[] => {
    const acc: string[] = [];
    const abs = isAbsolute(input) ? input : join(root, input);
    const walk = (p: string): void => {
      const st = statSync(p);
      if (st.isDirectory()) {
        for (const fn of readdirSync(p)) {
          walk(join(p, fn));
        }
        return;
      }
      if (st.isFile()) {
        if (isSrc(p)) {
          acc.push(p);
        }
      }
    };
    if (existsSync(abs)) {
      walk(abs);
    }
    return acc;
  };

  const processFile = (absPath: string): void => {
    const rel = relative(root, absPath).replaceAll("\\", "/");
    getOrAddModule(graph, rel, rel);
    const code = readFileSync(absPath, "utf8");
    const toks = lex(code);
    const ctx = {
      spec,
      graph,
      file: rel,
      root,
      scopes: [{ value: {}, type: {} }],
      symSeq: 0,
      callSeq: 0,
      callStack: [],
      eventsTmp: [],
    };
    const start = Object.keys(spec.rules)[0];
    try {
      runParse(peg, spec, start, toks, ctx);
    } catch (e) {
      addEdge(graph, "parseError", rel, rel, { message: e instanceof Error ? e.message : String(e) });
    }
  };

  const indexPaths = (paths: string[]): CodeGraph => {
    const files: string[] = [];
    for (const p of paths) {
      const abs = isAbsolute(p) ? p : join(root, p);
      if (!existsSync(abs)) {
        continue;
      }
      const st = statSync(abs);
      if (st.isDirectory()) {
        files.push(...collectFiles(abs));
      } else if (st.isFile()) {
        files.push(abs);
      }
    }
    files.sort();
    for (const f of files) {
      processFile(f);
    }
    return graph;
  };

  return { graph, indexPaths };
}
