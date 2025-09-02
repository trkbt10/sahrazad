/**
 * @file Unit tests for the KGF lexer builder.
 */
import { buildLexer } from "./lexer";
import type { TokenDef } from "./types";

describe("lexer", () => {
  it("tokenizes identifiers and skips whitespace", () => {
    const toks: TokenDef[] = [
      { name: "IDENT", pattern: "[A-Za-z_][A-Za-z0-9_]*" },
      { name: "SKIP", pattern: "\\s+", skip: true },
    ];
    const lex = buildLexer(toks);
    const out = lex("alpha beta");
    expect(out.map((t) => t.kind)).toEqual(["IDENT", "IDENT"]);
    expect(out.map((t) => t.text)).toEqual(["alpha", "beta"]);
    expect(out[0]?.pos).toBe(0);
    expect(typeof out[1]?.pos).toBe("number");
  });
});

