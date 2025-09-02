/**
 * @file Lexer builder for KGF token definitions. Prefers first non-null capture group
 * for token text and ignores SKIP rules. Uses matchAll to avoid mutable control state.
 */
import type { Tok, TokenDef } from "./types";
/** Build a lexer function from token definitions. */
export function buildLexer(tokens: TokenDef[]): (input: string) => Tok[] {
  const parts = tokens.map((t) => `(?<${t.skip ? "SKIP" : t.name}>${t.pattern})`);
  const master = new RegExp(parts.join("|"), "gms");

  return (input: string): Tok[] => {
    const matches = Array.from(input.matchAll(master));
    return matches
      .map<Tok | null>((m) => {
        const groups = (m as RegExpMatchArray).groups ?? ({} as Record<string, string | undefined>);
        const kind = Object.keys(groups).find((k) => groups[k] != null && m[0] === groups[k]) ?? "";
        if (kind === "SKIP") {
          return null;
        }
        const cap = Array.from({ length: m.length - 1 }, (_, k) => m[k + 1]).find((g) => g != null);
        const text = (cap as string | undefined) ?? m[0]!;
        return { kind, text, pos: m.index };
      })
      .filter((t): t is Tok => t !== null);
  };
}
