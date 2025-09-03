# Attrs Section (Rule Actions)

When a rule successfully matches, its `attrs` are executed in order before `semantics`.

Supported actions (minimal runtime)

- `def id=<label> kind=<string> ns=value|type`
  - Creates a symbol id `${file}::${ns}:${name}#<seq>`; binds to current scope; emits `declares` edge.
- `ref name=<label> ns=value|type`
  - Resolves by walking scopes; emits `references` edge when resolved.
- `call callee=<label>`
  - Emits `calls` edge to resolved callee or an unresolved logical id; pushes a call id onto a stack.
- `argref index=<number?>`
  - Collects `Ref` events since last argument boundary; emits `argumentUses` edges for the current call. Minimal index handling (`index` optional; default 0).
- `import module=<label>`
  - Resolves a module path via `resolver`; emits `moduleDependsOn` edge; ensures the target module node exists.
- `import_bind module=<label> import=<label> local=<label> ns=value|type`
  - Binds local alias to a proxy symbol in the resolved external module; emits `importsSymbol` edge.
- `reexport module=<label>`
  - Resolves and emits `reexports` edge.
- `scope push=<string>` / `scope pop`
  - Pushes/pops a scope frame (both `value` and `type` tables).

Notes

- Actions are “augmentative”: they do not suppress `semantics`. Use `semantics` to add or reshape edges if needed.
- Argument handling is intentionally minimal in this runtime.

