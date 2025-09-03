/**
 * @file KGF spec parser: extracts lex/grammar/attrs/resolver and normalizes resolver.
 */
import type { AttrAction, KGFSpec, ResolverAlias, ResolverSpec, RuleDef, TokenDef } from "./types";
import type { SemExpr, SemOnBlock, SemStmt } from "./types";

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
  const sem = parseSemantics(section(text, "semantics"));
  return { language, tokens: toks, rules, attrs, resolver, semantics: sem };
}

/**
 * Parse semantics section into rule -> on-blocks.
 * Minimal parser using line scanning and balanced braces; expressions are parsed ad-hoc.
 */
export function parseSemantics(text: string): Record<string, SemOnBlock[]> | undefined {
  const src = text ?? "";
  const trimmed = src.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const N = trimmed.length;
  const skipWs = (j: number): number => (/\s/.test(trimmed[j] ?? "")) ? skipWs(j + 1) : j;
  const readIdent = (j: number): [string, number] => {
    const step = (k: number): number => (/^[A-Za-z0-9_]$/.test(trimmed[k] ?? "")) ? step(k + 1) : k;
    const end = step(j);
    return [trimmed.slice(j, end), end];
  };
  const readUntilBrace = (j: number): [string, number] => {
    const k0 = skipWs(j);
    if (trimmed[k0] !== '{') { return ["", j]; }
    const walk = (p: number, depth: number): number => {
      if (p >= N) { return -1; }
      const ch = trimmed[p]!;
      if (ch === '{') { return walk(p + 1, depth + 1); }
      if (ch === '}') { return depth === 1 ? p : walk(p + 1, depth - 1); }
      return walk(p + 1, depth);
    };
    const endPos = walk(k0, 0);
    if (endPos < 0) { return ["", j]; }
    return [trimmed.slice(k0 + 1, endPos), endPos + 1];
  };

  const parseExpr = (s: string): SemExpr => {
    const S = s.trim();
    if (S === "true" || S === "false") { return { kind: "bool", value: S === "true" }; }
    if (S === "null") { return { kind: "null" }; }
    if (/^\d+$/.test(S)) { return { kind: "num", value: Number.parseInt(S, 10) }; }
    if (S.startsWith('"') && S.endsWith('"')) { return { kind: "str", value: S.slice(1, -1) }; }
    if (S.startsWith("$") && /^[A-Za-z_][A-Za-z0-9_]*\(.*\)$/.test(S)) {
      const name = S.slice(1, S.indexOf("("));
      const inner = S.slice(S.indexOf("(") + 1, -1);
      const args = splitArgs(inner).map(parseExpr);
      return { kind: "call", name, args };
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*\(.*\)$/.test(S)) {
      const name = S.slice(0, S.indexOf("("));
      const inner = S.slice(S.indexOf("(") + 1, -1);
      const args = splitArgs(inner).map(parseExpr);
      return { kind: "func", name, args };
    }
    if (S.startsWith("$")) { return { kind: "var", name: S.slice(1) }; }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(S)) { return { kind: "var", name: S }; }
    return { kind: "str", value: S };
  };

  const splitArgs = (arglist: string): string[] => {
    const rec = (p: number, depth: number, inStr: boolean, buf: string, acc: string[]): string[] => {
      if (p >= arglist.length) {
        const last = buf.trim();
        return last.length > 0 ? [...acc, last] : acc;
      }
      const ch = arglist[p]!;
      if (ch === '"') { return rec(p + 1, depth, !inStr, buf + ch, acc); }
      if (!inStr && (ch === '(' || ch === '{')) { return rec(p + 1, depth + 1, inStr, buf + ch, acc); }
      if (!inStr && (ch === ')' || ch === '}')) { return rec(p + 1, depth - 1, inStr, buf + ch, acc); }
      if (!inStr && depth === 0 && ch === ',') { return rec(p + 1, depth, inStr, "", [...acc, buf.trim()]); }
      return rec(p + 1, depth, inStr, buf + ch, acc);
    };
    return rec(0, 0, false, "", []);
  };

  const parseBlockStmts = (body: string): SemStmt[] => {
    const lines = body.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("#"));
    const stmts: SemStmt[] = [];
    for (const ln of lines) {
      if (ln.startsWith("edge ")) {
        // edge kind from <expr> to <expr> [attrs <expr>]
        const m = ln.match(/^edge\s+([A-Za-z_][\w]*)\s+from\s+(.+?)\s+to\s+(.+?)(?:\s+attrs\s+(.+))?$/);
        if (m) {
          const kind = m[1]!; const from = parseExpr(m[2]!); const to = parseExpr(m[3]!);
          const attrs = m[4] ? parseExpr(m[4]!) : undefined;
          stmts.push({ kind: "edge", edgeKind: kind, from, to, attrs });
          continue;
        }
      }
      if (ln.startsWith("bind ")) {
        const m = ln.match(/^bind\s+ns\s+(.+)\s+name\s+(.+)\s+to\s+(.+)$/);
        if (m) {
          stmts.push({ kind: "bind", ns: parseExpr(m[1]!), name: parseExpr(m[2]!), to: parseExpr(m[3]!) });
          continue;
        }
      }
      if (ln.startsWith("note ")) {
        const m = ln.match(/^note\s+([A-Za-z_][\w]*)(?:\s+payload\s+(.+))?$/);
        if (m) {
          stmts.push({ kind: "note", noteType: m[1]!, payload: m[2] ? parseExpr(m[2]!) : undefined });
          continue;
        }
      }
      if (ln.startsWith("let ")) {
        const m = ln.match(/^let\s+([A-Za-z_][\w]*)\s*=\s*(.+)$/);
        if (m) {
          stmts.push({ kind: "let", id: m[1]!, value: parseExpr(m[2]!) });
          continue;
        }
      }
      if (ln.startsWith("for ")) {
        // Minimal single-line body not supported; recommend block flattening
        // For simplicity in this version, ignore and parse as no-op
        continue;
      }
    }
    return stmts;
  };

  const parseOnBlocks = (idx: number, acc: SemOnBlock[]): [SemOnBlock[], number] => {
    const at = skipWs(idx);
    if (at >= N) { return [acc, at]; }
    if (!trimmed.startsWith("on", at)) { return [acc, at]; }
    const afterOn = skipWs(at + 2);
    const [rule, j1] = readIdent(afterOn);
    const afterRule = skipWs(j1);
    const hasWhen = trimmed.startsWith("when", afterRule);
    const afterWhen = hasWhen ? skipWs(afterRule + 4) : afterRule;
    const bracePos = hasWhen ? trimmed.indexOf("{", afterWhen) : -1;
    const condStr = hasWhen ? trimmed.slice(afterWhen, bracePos).trim() : "";
    const condExpr: SemExpr | undefined = hasWhen ? (condStr.length > 0 ? parseExpr(condStr) : undefined) : undefined;
    const posAfterCond = hasWhen ? bracePos : afterRule;
    const [body, j2] = readUntilBrace(posAfterCond);
    const afterBody = skipWs(j2);
    const hasElse = trimmed.startsWith("else", afterBody);
    const afterElse = hasElse ? skipWs(afterBody + 4) : afterBody;
    const pair = hasElse ? readUntilBrace(afterElse) : ["", afterBody] as [string, number];
    const elseBody = pair[0];
    const nextPos = pair[1];
    const elseParsed: SemStmt[] | undefined = hasElse ? parseBlockStmts(elseBody) : undefined;
    const block: SemOnBlock = { rule, when: condExpr, then: parseBlockStmts(body), else: elseParsed };
    return parseOnBlocks(nextPos, [...acc, block]);
  };
  const [blocks] = parseOnBlocks(0, []);
  const map: Record<string, SemOnBlock[]> = {};
  for (const b of blocks) {
    const arr = map[b.rule] ?? [];
    map[b.rule] = [...arr, b];
  }
  return map;
}
