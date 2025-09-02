/**
 * @file Tests for import_bind action creating local alias bindings to external module symbols.
 */
import { parseKGF } from "./spec";
import { buildLexer } from "./lexer";
import { buildPEG, runParse } from "./peg";
import { createGraph } from "./graph";

const kgf = `language: ts
=== lex
TOKEN IDENT /[A-Za-z_][A-Za-z0-9_]*/
SKIP /\\s+/
=== grammar
Start -> mod:IDENT imp:IDENT loc:IDENT
=== attrs
on Start: import_bind module=mod import=imp local=loc ns=value
=== resolver
sources: .ts
relative_prefixes: ./ ../ /
exts: .ts
indexes: /index.ts
`;

describe("import_bind action", () => {
  it("binds local alias to external symbol id and records edge", () => {
    const spec = parseKGF(kgf);
    const peg = buildPEG(spec);
    const lex = buildLexer(spec.tokens);
    const toks = lex("./module Foo F");
    const graph = createGraph();
    const ctx = {
      spec,
      graph,
      file: "src/main.ts",
      root: "/proj",
      scopes: [{ value: {}, type: {} }],
      symSeq: 0,
      callSeq: 0,
      callStack: [],
      eventsTmp: [],
    };
    runParse(peg, spec, "Start", toks, ctx);
    // binding should exist in current scope
    const sid = (ctx.scopes[0].value as Record<string, string>)["F"]; // value namespace
    expect(typeof sid).toBe("string");
    // and an edge importsSymbol should be present
    expect(graph.edges.some((e) => e.kind === "importsSymbol")).toBe(true);
  });
});
