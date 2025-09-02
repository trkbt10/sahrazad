/**
 * @file Additional unit tests for PEG evaluator: choice, star/plus/optional, label propagation, nested rules, imports.
 */
import { parseKGF } from "./spec";
import { buildLexer } from "./lexer";
import { buildPEG, runParse } from "./peg";
import { createGraph } from "./graph";

describe("peg runtime - extended", () => {
  it("parses choice and optional", () => {
    const kgf = `language: ts
=== lex
TOKEN IDENT /[A-Za-z_][A-Za-z0-9_]*/
SKIP /\\s+/
=== grammar
Choice -> a:IDENT | b:IDENT
Opt -> [name:IDENT]
=== attrs
# no actions needed for structural parse
=== resolver
sources: .ts
`;
    const spec = parseKGF(kgf);
    const peg = buildPEG(spec);
    const lex = buildLexer(spec.tokens);
    const tok1 = lex("alpha");
    const tok2 = lex("");
    const g = createGraph();
    const ctx1 = { spec, graph: g, file: "main.ts", root: "/p", scopes: [{ value: {}, type: {} }], symSeq: 0, callSeq: 0, callStack: [], eventsTmp: [] };
    const [lab1] = runParse(peg, spec, "Choice", tok1, ctx1);
    expect(lab1.a).toBe("alpha");
    const ctx2 = { spec, graph: g, file: "main.ts", root: "/p", scopes: [{ value: {}, type: {} }], symSeq: 0, callSeq: 0, callStack: [], eventsTmp: [] };
    const [lab2] = runParse(peg, spec, "Opt", tok2, ctx2);
    expect(lab2.name ?? null).toBeNull();
  });

  it("handles star/plus repetition and last label wins", () => {
    const kgf = `language: ts
=== lex
TOKEN IDENT /[A-Za-z_][A-Za-z0-9_]*/
SKIP /\\s+/
=== grammar
Many -> name:IDENT*
OneOrMore -> name:IDENT+
=== attrs
=== resolver
sources: .ts
`;
    const spec = parseKGF(kgf);
    const peg = buildPEG(spec);
    const lex = buildLexer(spec.tokens);
    const toks = lex("a b c");
    const g = createGraph();
    const ctx = { spec, graph: g, file: "f.ts", root: "/p", scopes: [{ value: {}, type: {} }], symSeq: 0, callSeq: 0, callStack: [], eventsTmp: [] };
    const [lab] = runParse(peg, spec, "Many", toks, ctx);
    expect(lab.name).toBe("c");
    const [lab2] = runParse(peg, spec, "OneOrMore", lex("x"), { ...ctx, eventsTmp: [], scopes: [{ value: {}, type: {} }] });
    expect(lab2.name).toBe("x");
  });

  it("supports nested label capture and def on outer rule", () => {
    const kgf = `language: ts
=== lex
TOKEN IDENT /[A-Za-z_][A-Za-z0-9_]*/
SKIP /\\s+/
=== grammar
Inner -> name:IDENT
Outer -> lab:Inner
=== attrs
on Outer: def id=lab kind=Var ns=value
=== resolver
sources: .ts
`;
    const spec = parseKGF(kgf);
    const peg = buildPEG(spec);
    const lex = buildLexer(spec.tokens);
    const g = createGraph();
    const ctx = { spec, graph: g, file: "m.ts", root: "/p", scopes: [{ value: {}, type: {} }], symSeq: 0, callSeq: 0, callStack: [], eventsTmp: [] };
    const [, events] = runParse(peg, spec, "Outer", lex("foo"), ctx);
    expect(events.some((e) => e[0] === "Def")).toBe(true);
  });

  it("emits moduleDependsOn for import action", () => {
    const kgf = `language: ts
=== lex
TOKEN IDENT /[A-Za-z_][A-Za-z0-9_]*/
SKIP /\\s+/
=== grammar
Imp -> m:IDENT
=== attrs
on Imp: import module=m
=== resolver
sources: .ts
relative_prefixes: ./ ../ /
exts: .ts
`;
    const spec = parseKGF(kgf);
    const peg = buildPEG(spec);
    const lex = buildLexer(spec.tokens);
    const g = createGraph();
    const ctx = { spec, graph: g, file: "src/main.ts", root: "/p", scopes: [{ value: {}, type: {} }], symSeq: 0, callSeq: 0, callStack: [], eventsTmp: [] };
    runParse(peg, spec, "Imp", lex("./mod"), ctx);
    expect(g.edges.some((e) => e.kind === "moduleDependsOn")).toBe(true);
  });
});

