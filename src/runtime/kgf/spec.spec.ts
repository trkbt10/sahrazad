/**
 * @file Unit tests for KGF spec parser components.
 */
import { parseKGF, parseLex, parseRules, parseAttrs, parseResolver } from "./spec";

describe("kgf spec parser", () => {
  it("parses sections and basics", () => {
    const text = `language: ts
=== lex
TOKEN IDENT /[a-zA-Z_][a-zA-Z0-9_]*/
SKIP /\\s+/
=== grammar
Start -> name:IDENT
=== attrs
on Start: def id=name kind=Variable ns=value
=== resolver
sources: .ts, .tsx
relative_prefixes: ./, ../, /
exts: .ts, .tsx
indexes: /index.ts
bare_prefix: npm:
module_path_style: slash
ns_segments: 2
rust_mod_mode: false
`; 
    const spec = parseKGF(text);
    expect(spec.language).toBe("ts");
    expect(spec.tokens.length).toBe(2);
    expect(Object.keys(spec.rules)).toEqual(["Start"]);
    expect(spec.attrs.Start?.[0]?.kind).toBe("def");
    expect(spec.resolver.sources).toContain(".ts");
  });

  it("parses helper functions", () => {
    expect(parseLex("TOKEN A /a/").length).toBe(1);
    expect(Object.keys(parseRules("A -> B\nB -> C")).length).toBe(2);
    const attrs = parseAttrs("on A: def id=name; ref name=name");
    expect(attrs.A?.length).toBeGreaterThan(0);
    const res = parseResolver("sources: .js .ts\n");
    expect(res.sources).toContain(".ts");
  });
});
