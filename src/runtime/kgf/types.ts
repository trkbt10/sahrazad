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
};

// Lexer
export type Tok = {
  kind: string;
  text: string;
  pos: number;
};
