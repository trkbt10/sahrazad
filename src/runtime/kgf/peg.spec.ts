/**
 * @file PEG executor smoke tests (def/ref emissions).
 */
import { parseKGF } from "./spec";
import { buildLexer } from "./lexer";
import { buildPEG, runParse } from "./peg";
import { createGraph } from "./graph";

describe("peg runtime", () => {
  it("parses simple ident and emits def/ref", () => {
    const text = `language: ts
=== lex
TOKEN IDENT /[a-zA-Z_][a-zA-Z0-9_]*/
SKIP /\\s+/
=== grammar
Start -> name:IDENT name2:IDENT
=== attrs
on Start: def id=name kind=Var ns=value; ref name=name2 ns=value
=== resolver
sources: .ts
relative_prefixes: ./ ../ /
exts: .ts
indexes: /index.ts
`;
    const spec = parseKGF(text);
    const peg = buildPEG(spec);
    const lex = buildLexer(spec.tokens);
    const toks = lex("foo foo");
    const graph = createGraph();
    const ctx = { spec, graph, file: "main.ts", root: "/proj", scopes: [{ value: {}, type: {} }], symSeq: 0, callSeq: 0, callStack: [], eventsTmp: [] };
    const [labels, events] = runParse(peg, spec, "Start", toks, ctx);
    expect(labels.name).toBe("foo");
    expect(events.some((e) => e[0] === "Def")).toBe(true);
    expect(events.some((e) => e[0] === "Ref")).toBe(true);
  });
});
