# Runtime Components & Output

Components

- Lexer (`lexer.ts`):
  - Combines all token/skip patterns; returns tokens `{ kind, text, pos }`.
- PEG (`peg.ts`):
  - Minimal recursive descent with memoization; supports labels/choice/repetition.
  - Executes `attrs` and then `semantics` on rule completion; also for the start rule.
- Resolver (`resolver.ts`):
  - Resolves module specifiers using `aliases`, `relative_prefixes`, `exts`, `indexes`, `bare_prefix`, `module_path_style`, `ns_prefix`.
- Graph (`graph.ts`):
  - In‑memory graph ops and JSON conversion.
- Tool (`tool.ts`):
  - Indexes files under a project root according to `resolver.sources` and applies the program.

Scopes and Namespaces

- A scope frame contains `{ value: Record<string, string>, type: Record<string, string> }`.
- `def`/`bind` write to the current frame; `ref`/`$scope` look up from innermost to outermost.

Edges & JSON

- Modules: `{ [id]: { file: string | null } }` — logical ids (e.g., `npm:react`, `url:...`) have `file: null`.
- Symbols: `{ [id]: { name, kind, ns, module } }` — minimal symbol metadata.
- Edges: list of objects `{ kind, from, to, ...attrs }`.

Error handling

- Parse failures for a file create a `parseError` edge with a message; indexing continues.

