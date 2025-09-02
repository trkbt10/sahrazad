/**
 * @file Additional unit tests for KGF spec parser helpers (lex, rules, attrs, resolver, kgf).
 */
import { parseLex, parseRules, parseAttrs, parseResolver, parseKGF } from "./spec";

describe("spec helpers - extended", () => {
  it("parseLex handles TOKEN and SKIP with comments", () => {
    const text = `# comment\nTOKEN ID /[a-z]+/\nSKIP /\\s+/\n`;
    const toks = parseLex(text);
    expect(toks.length).toBe(2);
    expect(toks[0]?.name).toBe("ID");
    expect(toks[1]?.skip).toBe(true);
  });

  it("parseRules preserves multi-line bodies and ignores comments", () => {
    const text = `R -> ID\n  # comment\n  ID\nS -> R\n`;
    const rules = parseRules(text);
    expect(Object.keys(rules)).toEqual(["R", "S"]);
    expect(/ID\s+ID/.test(rules.R.expr)).toBe(true);
  });

  it("parseAttrs reads multiple actions and params", () => {
    const text = `on R: def id=name kind=Var ns=value; ref name=refName ns=type`;
    const attrs = parseAttrs(text);
    expect(attrs.R?.length).toBe(2);
    expect(attrs.R?.[0]?.kind).toBe("def");
    expect(attrs.R?.[1]?.kind).toBe("ref");
  });

  it("parseResolver handles alias blocks with indentation and fields", () => {
    const text = `sources: .ts .tsx\nrelative_prefixes: ./ ../ /\nexts: .ts .tsx\nindexes: /index.ts\naliases:\n  -\n    pattern: ^@/\n    replace: src/\n`;
    const res = parseResolver(text);
    expect(res.sources).toContain(".ts");
    expect(res.aliases.length).toBeGreaterThan(0);
  });

  it("parseKGF composes full spec from sections", () => {
    const kgf = `language: ts\n=== lex\nTOKEN ID /[a-z]+/\nSKIP /\\s+/\n=== grammar\nStart -> ID\n=== attrs\n# none\n=== resolver\nsources: .ts\n`;
    const spec = parseKGF(kgf);
    expect(spec.language).toBe("ts");
    expect(Object.keys(spec.rules)).toEqual(["Start"]);
  });
});
