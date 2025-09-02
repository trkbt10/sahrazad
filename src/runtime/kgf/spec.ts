/**
 * @file KGF spec parser: extracts lex/grammar/attrs/resolver and normalizes resolver.
 */
import type { AttrAction, KGFSpec, ResolverAlias, ResolverSpec, RuleDef, TokenDef } from "./types";

/** Extract section body by heading marker `=== name`. */
function section(text: string, name: string): string {
  const marker = `=== ${name}`;
  const idx = text.indexOf(marker);
  if (idx < 0) {
    return "";
  }
  const body = text.slice(idx + marker.length);
  const split = body.split("===", 1);
  return split.length > 0 ? split[0] : body;
}

/** Split a comma/whitespace list into string array. */
function parseList(s: string | undefined): string[] {
  if (!s) {
    return [];
  }
  return s
    .split(/[,\s]+/g)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/** Parse resolver block into normalized ResolverSpec. */
export function parseResolver(text: string): ResolverSpec {
  const lines = text.split(/\r?\n/);

  const parseAliasesBlock = (i0: number, acc: ResolverAlias[]): [number, ResolverAlias[]] => {
    if (i0 >= lines.length) {
      return [i0, acc];
    }
    const li = lines[i0];
    const startsTwoSpaces = li.startsWith("  ");
    if (!startsTwoSpaces) {
      const startsTab = li.startsWith("\t");
      if (!startsTab) { return [i0, acc]; }
    }
    const sub = li.trim();
    if (!sub.startsWith("-")) {
      return parseAliasesBlock(i0 + 1, acc);
    }
    const collect = (k: number, pat?: string, rep?: string): [number, ResolverAlias] => {
      if (k >= lines.length) {
        return [k, { pattern: pat ?? "", replace: rep ?? "" }];
      }
      const s = lines[k];
      const startsFourSpaces = s.startsWith("    ");
      if (!startsFourSpaces) {
        const startsTwoTabs = s.startsWith("\t\t");
        if (!startsTwoTabs) { return [k, { pattern: pat ?? "", replace: rep ?? "" }]; }
      }
      const t = s.trim();
      const key = t.split(":", 1)[0]?.trim() ?? "";
      const val = t.slice(t.indexOf(":") + 1).trim();
      if (key === "pattern") {
        return collect(k + 1, val, rep);
      }
      if (key === "replace") {
        return collect(k + 1, pat, val);
      }
      return collect(k + 1, pat, rep);
    };
    const [j1, alias] = collect(i0 + 1);
    return parseAliasesBlock(j1, [...acc, alias]);
  };

  const walk = (i: number, kv: Record<string, string>, aliases: ResolverAlias[]): [Record<string, string>, ResolverAlias[]] => {
    if (i >= lines.length) {
      return [kv, aliases];
    }
    const raw = lines[i] ?? "";
    const ln = raw.trim();
    if (ln === "" || ln.startsWith("#")) {
      return walk(i + 1, kv, aliases);
    }
    if (ln.startsWith("aliases:")) {
      const [next, aliases2] = parseAliasesBlock(i + 1, []);
      return walk(next, kv, [...aliases, ...aliases2]);
    }
    if (ln.includes(":")) {
      const k = ln.split(":", 1)[0]?.trim() ?? "";
      const v = ln.slice(ln.indexOf(":") + 1).trim();
      return walk(i + 1, { ...kv, [k]: v }, aliases);
    }
    return walk(i + 1, kv, aliases);
  };

  const [kv, aliases] = walk(0, {}, []);

  const spec: ResolverSpec = {
    sources: parseList(kv["sources"]),
    relative_prefixes: parseList(kv["relative_prefixes"]),
    exts: parseList(kv["exts"]),
    indexes: parseList(kv["indexes"]),
    bare_prefix: kv["bare_prefix"] ?? "",
    module_path_style: (kv["module_path_style"] as "slash" | "dot" | "coloncol") ?? "slash",
    aliases,
    ns_prefix: kv["ns_prefix"] === undefined || kv["ns_prefix"] === "" ? undefined : kv["ns_prefix"],
    ns_segments: Number.parseInt(kv["ns_segments"] ?? "2", 10),
    rust_mod_mode: (kv["rust_mod_mode"] ?? "false").toLowerCase() === "true",
    cargo_auto_from_roots: parseList(kv["cargo_auto_from_roots"]),
  };
  return spec;
}

/** Parse the lex section into token definitions with optional SKIP rules. */
export function parseLex(lexText: string): TokenDef[] {
  /** Parse the lex section into token definitions with optional SKIP rules. */
  const lines = lexText.split(/\r?\n/);
  return lines.reduce<TokenDef[]>((acc, lnRaw) => {
    const ln = lnRaw.trim();
    if (ln === "" || ln.startsWith("#")) {
      return acc;
    }
    if (ln.startsWith("SKIP")) {
      const m = ln.match(/^SKIP\s+\/(.*)\//);
      if (m) {
        return [...acc, { name: "SKIP", pattern: m[1]!, skip: true }];
      }
      return acc;
    }
    if (ln.startsWith("TOKEN")) {
      const m = ln.match(/^TOKEN\s+([A-Za-z_][\w]*)\s+\/((?:\\.|[^/])*)\//);
      if (m) {
        return [...acc, { name: m[1]!, pattern: m[2]! }];
      }
    }
    return acc;
  }, []);
}

/** Parse rule lines into rule name to expression mapping, preserving newlines between indented lines. */
export function parseRules(grammarText: string): Record<string, RuleDef> {
  const lines = grammarText.split(/\r?\n/);
  type State = { rules: Record<string, RuleDef>; name: string | null; buf: string[] };
  const init: State = { rules: {}, name: null, buf: [] };
  const st = lines.reduce<State>((state, lnRaw) => {
    const ln = lnRaw.trim();
    if (ln === "" || ln.startsWith("#")) {
      if (state.name) {
        return { ...state, buf: [...state.buf, "\n"] };
      }
      return state;
    }
    const m = lnRaw.match(/^([A-Za-z_][\w]*)\s*->\s*(.*)$/);
    if (m) {
      if (state.name) {
        const expr = state.buf.join("").trim();
        const nextRules = { ...state.rules, [state.name]: { name: state.name, expr } };
        return { rules: nextRules, name: m[1]!, buf: [m[2]!] };
      }
      return { ...state, name: m[1]!, buf: [m[2]!] };
    }
    if (state.name) {
      return { ...state, buf: [...state.buf, "\n" + lnRaw.trim()] };
    }
    return state;
  }, init);
  const closed = st.name ? { ...st.rules, [st.name]: { name: st.name, expr: st.buf.join("").trim() } } : st.rules;
  return closed;
}

/** Parse simple one-line attribute actions per rule into structured form. */
export function parseAttrs(attrsText: string): Record<string, AttrAction[]> {
  const re = /on\s+([A-Za-z_]\w*)\s*:\s*([^\n]+)/g;
  const matches = Array.from(attrsText.matchAll(re));
  return matches.reduce<Record<string, AttrAction[]>>((acc, m) => {
    const rule = m[1]!;
    const actions = m[2]!;
    const acts = actions
      .split(";")
      .map((partRaw) => partRaw.trim())
      .filter((part) => part !== "")
      .map<AttrAction>((part) => {
        const bits = part.split(/\s+/g);
        const head = bits[0]!;
        const kvs = bits.slice(1);
        const params = kvs.reduce<Record<string, string>>((p, kv) => {
          if (kv.includes("=")) {
            const k = kv.split("=", 1)[0]!;
            const v = kv.slice(k.length + 1);
            return { ...p, [k]: v };
          }
          return p;
        }, {});
        return { kind: head, params };
      });
    return { ...acc, [rule]: acts };
  }, {});
}

/** Parse a full KGF document text into a structured spec. */
export function parseKGF(text: string): KGFSpec {
  const lines = text.split(/\r?\n/);
  const langLine = lines.find((lnRaw) => lnRaw.trim().startsWith("language:"));
  const language = langLine ? langLine.slice(langLine.indexOf(":") + 1).trim() : "generic";
  const toks = parseLex(section(text, "lex"));
  const rules = parseRules(section(text, "grammar"));
  const attrs = parseAttrs(section(text, "attrs"));
  const resolver = parseResolver(section(text, "resolver"));
  return { language, tokens: toks, rules, attrs, resolver };
}
