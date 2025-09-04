# Appendix: Sample LLM Prompt to Draft a KGF Spec

This appendix provides a pragmatic prompt you can give to an LLM to draft a KGF specification for an arbitrary codebase. The goal is resilient, flexible graph extraction — not perfect language completeness. Prefer robust, under‑specified rules that won’t break.

Guiding principles

- Favor flexibility over strict completeness; keep parsing simple and resilient.
- Capture “relationship cores” first: module/file dependencies, declarations, references, calls, and re‑exports.
- Keep `lex`/`grammar` small and composable; use `attrs` and optionally `semantics` to map events into edges.
- Provide a minimal but correct `resolver` suited to the codebase (extensions, relative prefixes, aliases).

Deliverable format

- Output a single KGF document with these sections in order: `language:` header, `=== lex`, `=== grammar`, `=== attrs`, `=== resolver`, and (optionally) `=== semantics`.
- Do not include any explanation outside the KGF document.

Template prompt

```
You are to write a minimal, resilient KGF v0.5 spec for the following codebase.

Goals
- Extract a useful dependency graph (modules, declarations, references, calls) without breaking.
- Keep lex/grammar small and robust; prefer under‑approximation over over‑fitting.
- Use attrs to produce edges: declares, references, moduleDependsOn, reexports, calls, argumentUses (if available).
- Provide a resolver tailored to the repository (extensions, relative prefixes, aliases, indexes).
- Optional: add a semantics block for additional mapping using simple expressions.

Repository signals (summarize what you see)
- Language(s) and common file extensions
- Import/require/include patterns and relative vs bare specifiers
- Declaration/identifier patterns relevant to references/calls
- Any path aliases (e.g., @/ → src/)

Output constraints
- Produce only a single KGF document. No prose around it.
- Sections required: language header, === lex, === grammar, === attrs, === resolver. === semantics is optional.
- Prefer resilience: keep regexes conservative; avoid catastrophic backtracking.

KGF skeleton to fill

language: <short-language-tag>

=== lex
# Keep to a handful of tokens; add SKIP for whitespace/comments
SKIP /\s+/
# Example tokens (adjust to the language):
# TOKEN IDENT /[A-Za-z_][A-Za-z0-9_]*/
# TOKEN IMPORT /import\b/
# TOKEN STRING /"([^"]*)"|'([^']*)'/

=== grammar
# Pick a simple start rule that visits top‑level forms and import lines
Start -> ( Top | Import | Reexport | Decl | Stmt )*
# Define a few minimal rules (labels capture last token value into a label)
# Import   -> IMPORT ... mod:STRING
# Decl     -> name:IDENT ...
# Stmt     -> name:IDENT ...

=== attrs
# Map rule completions to edges; prefer robust emissions
# on Decl: def id=name kind=Var ns=value
# on Stmt: ref name=name ns=value
# on Import: import module=mod
# on Reexport: reexport module=mod

=== resolver
# Fill with the repository’s reality
sources: .<ext1> .<ext2>
relative_prefixes: ./ ../ /
exts: .<ext1> .<ext2>
indexes: /index.<ext1>
bare_prefix: npm:
module_path_style: slash
aliases:
  -
    pattern: ^@/
    replace: src/

=== semantics
# Optional; add only if it simplifies mapping without adding fragility.
# Example: combine declare+reference in a single on‑block.
# on Start when $scope("value", $name) {
#   edge references from $file to $scope("value", $name) attrs obj("ref_kind", "value")
# }
```

Review checklist for the generated spec

- `lex`: SKIP is present; a handful of tokens; patterns are conservative.
- `grammar`: small set of rules; labels on the pieces you want to refer to.
- `attrs`: covers `def`, `ref`, `import` (`reexport` if needed), and optionally `call`/`argref`.
- `resolver`: lists actual extensions; relative prefixes make sense; aliases reflect the repo.
- `semantics` (optional): only if it meaningfully simplifies mapping; keep expressions simple.

Usage tips

- Start small: module dependencies first (`import`/`moduleDependsOn`). Add `declares`/`references` next.
- If a rule is too brittle, simplify it; prefer matching “good enough” over precise AST fidelity.
- Re‑run the KGF over the repository and iterate tokens/rules minimally until the graph is stable.

