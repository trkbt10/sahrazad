/**
 * @file Shared type aliases for the KGF runtime.
 */
export type Dict<T = unknown> = Record<string, T>;

// Graph types
export type ModuleNode = {
  id: string;
  file?: string | null;
};

export type SymbolNode = {
  id: string;
  name: string;
  kind: string;
  ns: string;
  module: string;
};

export type Edge = {
  kind: string;
  from: string;
  to: string;
  attrs?: Dict;
};

export type CodeGraphJson = {
  modules: Record<string, { file: string | null | undefined }>;
  symbols: Record<string, { name: string; kind: string; ns: string; module: string }>;
  edges: Array<Dict>;
};

// Resolver
export type ResolverAlias = {
  pattern: string;
  replace: string;
};

export type ResolverSpec = {
  sources: string[];
  relative_prefixes: string[];
  exts: string[];
  indexes: string[];
  bare_prefix: string;
  module_path_style: "slash" | "dot" | "coloncol";
  aliases: ResolverAlias[];
  ns_prefix?: string;
  ns_segments: number;
  rust_mod_mode: boolean;
  cargo_auto_from_roots: string[];
};

// Spec
export type TokenDef = {
  name: string;
  pattern: string;
  skip?: boolean;
};

export type RuleDef = {
  name: string;
  expr: string;
};

export type AttrAction = {
  // def, ref, call, argref, import, reexport, scope, arg_begin, arg_end, call_end
  kind: string;
  params: Record<string, string>;
};

export type KGFSpec = {
  language: string;
  tokens: TokenDef[];
  rules: Record<string, RuleDef>;
  attrs: Record<string, AttrAction[]>;
  resolver: ResolverSpec;
  semantics?: Record<string, SemOnBlock[]>;
};

// Lexer
export type Tok = {
  kind: string;
  text: string;
  pos: number;
};

// Semantics DSL (minimal AST)
export type SemExpr =
  | { kind: "str"; value: string }
  | { kind: "num"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "null" }
  | { kind: "var"; name: string }
  | { kind: "call"; name: string; args: SemExpr[] }
  | { kind: "func"; name: string; args: SemExpr[] };

export type SemStmt =
  | { kind: "edge"; edgeKind: string; from: SemExpr; to: SemExpr; attrs?: SemExpr }
  | { kind: "bind"; ns: SemExpr; name: SemExpr; to: SemExpr }
  | { kind: "note"; noteType: string; payload?: SemExpr }
  | { kind: "let"; id: string; value: SemExpr }
  | { kind: "for"; id: string; iter: SemExpr; body: SemStmt[] };

export type SemOnBlock = {
  rule: string;
  when?: SemExpr;
  then: SemStmt[];
  else?: SemStmt[];
};
