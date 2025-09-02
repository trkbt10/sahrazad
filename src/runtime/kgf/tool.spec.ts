/**
 * @file Unit tests for the high-level KGF tool indexer.
 */
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseKGF } from "./spec";
import { createTool } from "./tool";

describe("tool indexer", () => {
  it("indexes a simple TS file and emits a declaration edge", () => {
    const kgf = `language: ts
=== lex
TOKEN IDENT /[A-Za-z_][A-Za-z0-9_]*/
SKIP /\\s+/
=== grammar
Start -> name:IDENT
=== attrs
on Start: def id=name kind=Var ns=value
=== resolver
sources: .ts
relative_prefixes: ./ ../ /
exts: .ts
indexes: /index.ts
`;
    const spec = parseKGF(kgf);
    const root = mkdtempSync(join(tmpdir(), "kgf-tool-"));
    // write a simple file
    const srcDir = join(root);
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "hello.ts"), "hello", { encoding: "utf8" });
    const tool = createTool(spec, root);
    const graph = tool.indexPaths([root]);
    const modules = Object.keys(graph.modules);
    expect(modules.some((m) => m.endsWith("hello.ts"))).toBe(true);
    const hasDeclares = graph.edges.some((e) => e.kind === "declares");
    expect(hasDeclares).toBe(true);
  });
});

