# Lex Section

Purpose

- Declare tokens and whitespace/comments to skip. The lexer is a single combined RegExp that emits token spans over the entire input.

Syntax

- `SKIP /(…)/` — pattern to discard. Multiple SKIPs are allowed. The runtime does not emit tokens for SKIP matches.
- `TOKEN NAME /((?:\\.|[^/])*)/` — define a token named `NAME` with a JavaScript‑style RegExp between slashes.

Capture selection

- If a token pattern has capture groups, the first non‑null capture is used as the token text; otherwise, the full match is used.

Notes

- The combined RegExp uses `gms` flags; newlines may be matched depending on your pattern.
- The lexer returns a list of tokens `{ kind, text, pos }` (pos is the starting byte offset in the input string).

Example

```
SKIP /\s+/
TOKEN IDENT /[A-Za-z_][A-Za-z0-9_]*/
```

