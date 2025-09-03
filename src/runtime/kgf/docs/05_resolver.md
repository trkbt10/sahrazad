# Resolver Section

Purpose

- Describe how module specifiers in `import`/`reexport`/semantics are resolved to module ids.

Supported fields

- `sources: <list>` — file extensions (e.g., `.ts .tsx .js .jsx .html`); used to filter which files are indexed.
- `relative_prefixes: <list>` — prefixes considered relative (e.g., `./ ../ / http:// https:// mailto: ftp:// data:`). Special handling:
  - `/path`: resolved from project root.
  - `./path` or `../path`: resolved from the importing file’s directory.
- `exts: <list>` — ordered list of file extensions to try when no extension is present.
- `indexes: <list>` — ordered list of index suffixes (e.g., `/index.ts`).
- `bare_prefix: <string>` — when resolution fails, return `bare_prefix + head` (first segment of the module id).
- `module_path_style: slash|dot|coloncol` — converts module id to a path:
  - `dot`: `a.b.c` → `a/b/c`
  - `coloncol`: `ns::mod::file` → `ns/mod/file`
  - `slash`: no change
- `aliases:` — list of `{ pattern, replace }` pairs (RegExp applied in order) before path resolution.
- `ns_prefix: <string>` & `ns_segments: <number>` — if a module id contains backslashes (`Foo\Bar\Baz`) and is not relative, map the first N segments to `ns_prefix + joined` (e.g., for PHP‑like namespaces).

Resolution outline

1) Apply `aliases` to the input specifier.
2) If `ns_prefix` applies, return `ns_prefix + firstSegments`.
3) If specifier is `relative_prefix`: resolve from file (or root for `/`), try `exts` then `indexes`. On failure, return `bare_prefix + original`.
4) Otherwise try under project root (apply `module_path_style`), with `exts` then `indexes`. On failure, return `bare_prefix + head` or the original.

Notes

- The runtime creates module nodes on demand with `file: <path>` or `null` for logical ids (e.g., `npm:react`, `url:...`).
- Fields like `rust_mod_mode` / `cargo_auto_from_roots` are currently parsed but not used in the minimal resolver.

