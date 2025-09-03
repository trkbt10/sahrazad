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

