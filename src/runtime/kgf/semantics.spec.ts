/**
 * @file Semantics DSL integration tests (def/ref via semantics only).
 */
import { parseKGF } from "./spec";
import { buildLexer } from "./lexer";
import { buildPEG, runParse } from "./peg";
import { createGraph } from "./graph";

describe("semantics dsl", () => {
  it("emits declares and references solely via semantics", () => {
    const kgf = `language: ts
=== lex
TOKEN IDENT /[A-Za-z_][A-Za-z0-9_]*/
SKIP /\\s+/
=== grammar
Start -> a:IDENT b:IDENT
=== attrs
# no attrs
=== semantics
on Start {
  let nm = $a
  let sid = concat($file, "::value:", nm, "#", $autoSym())
  bind ns "value" name nm to sid
  edge declares from $file to sid attrs obj("site", "top")
  let rsid = $scope("value", $b)
  edge references from $file to rsid attrs obj("ref_kind", "value")
}
=== resolver
sources: .ts
`;
    const spec = parseKGF(kgf);
    const peg = buildPEG(spec);
    const lex = buildLexer(spec.tokens);
    const toks = lex("foo foo");
    const graph = createGraph();
    const ctx = { spec, graph, file: "src/main.ts", root: "/p", scopes: [{ value: {}, type: {} }], symSeq: 0, callSeq: 0, callStack: [], eventsTmp: [] };
    runParse(peg, spec, "Start", toks, ctx);
    expect(graph.edges.some((e) => e.kind === "declares")).toBe(true);
  });
});
