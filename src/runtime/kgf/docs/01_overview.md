# Overview

This runtime executes KGF (Knowledge Graph Format) as the primary source of truth. The goal is to extract a useful dependency/relationship graph from source files without requiring strict or language‑specific plugins. The design favors flexibility and resilience over full precision.

Key points

- Flexible, not strict: it is acceptable to under‑approximate when inputs are diverse. Avoid breaking; produce a reasonable graph.
- Function‑based runtime: no classes; small, testable modules.
- Sections: `lex`, `grammar`, `attrs`, `resolver`, and optional `semantics`.
- Namespaces: two default namespaces are supported — `value` and `type`.
- Scopes: a simple stack (module → function → block) for name binding and lookup.
- Execution order per file: lex → parse (PEG) → on rule completion: run `attrs` then `semantics`.
- Graph: modules, symbols, and edges. Minimal fields; attributes on edges are allowed.

Not in scope (by design)

- Full language completeness (e.g., full TypeScript type system). KGF can model subsets as needed.
- Complex operator precedence handling in the core — model with grammar rules instead.

Full‑file examples

Example A — Small pseudo language ("minilang")

```
language: minilang

=== lex
SKIP /\s+/
TOKEN IDENT /[A-Za-z_][A-Za-z0-9_]*/
TOKEN NUMBER /(?:0|[1-9][0-9]*)/
TOKEN LPAREN /\(/
TOKEN RPAREN /\)/
TOKEN COMMA  /,/
TOKEN EQ     /=/

=== grammar
Start   -> (Stmt)*
Stmt    -> VarDecl | CallStmt
VarDecl -> name:IDENT EQ Expr
CallStmt-> callee:IDENT LPAREN (Arg ( COMMA Arg )*)? RPAREN
Arg     -> Expr
Expr    -> term:IDENT | NUMBER | CallExpr
CallExpr-> callee:IDENT LPAREN (Arg ( COMMA Arg )*)? RPAREN

=== attrs
on VarDecl:  def id=name kind=Var ns=value
on Expr:     ref name=term ns=value
on CallStmt: call callee=callee
on Arg:      argref

=== resolver
sources: .ml
relative_prefixes: ./ ../ /
exts: .ml
indexes: /index.ml
bare_prefix: npm:
module_path_style: slash

=== semantics
# Optional; not required for this tiny sample.
```

Example B — Natural‑language flavored ("markdown‑lite")

```
language: markdown-lite

=== lex
SKIP /\s+/
TOKEN LBRACK /\[/
TOKEN RBRACK /\]/
TOKEN LPAREN /\(/
TOKEN RPAREN /\)/
TOKEN TEXT   /[^\s\[\]\(\)]+/

=== grammar
Doc   -> (InlineLink | WORD )*
WORD  -> TEXT
InlineLink -> LBRACK label:TEXT RBRACK LPAREN target:TEXT RPAREN

=== attrs
on InlineLink: import module=target

=== resolver
sources: .md .markdown .mdx
relative_prefixes: ./ ../ / http:// https:// mailto: ftp:// data:
exts: .md .markdown .mdx .html .png .jpg .jpeg .gif .svg
indexes: /README.md /index.md
bare_prefix: url:
module_path_style: slash

=== semantics
on InlineLink {
  edge moduleDependsOn from $file to $resolve($target) attrs obj("via", $target, "dep_kind", "value")
}
```

