/**
 * @file Minimal PEG evaluator and attribute-action executor for KGF.
 * It parses rule expressions to an AST and evaluates tokens, emitting graph events.
 */
import type { AttrAction, KGFSpec, Tok } from "./types";
import { addEdge } from "./graph";
import type { CodeGraph } from "./graph";
import { resolveModule } from "./resolver";

// Minimal PEG and executor based on kgf_v5 runtime (function-style)

type Node =
  | ["EMPTY"]
  | ["SYM", string]
  | ["SEQ", Node[]]
  | ["CHOICE", Node[]]
  | ["STAR", Node]
  | ["PLUS", Node]
  | ["Q", Node]
  | ["LABEL", string, Node];

export type PEG = {
  tokens: Set<string>;
  ast: Record<string, Node>;
  attrs: Record<string, AttrAction[]>;
};

export type ExecCtx = {
  spec: KGFSpec;
  graph: CodeGraph;
  file: string;
  root: string;
  scopes: Array<Record<"value" | "type", Record<string, string>>>;
  symSeq: number;
  callSeq: number;
  callStack: string[];
  eventsTmp: Array<[string, Record<string, unknown>]>;
};

function tokenizeExpr(s: string): Array<[string, string]> {
  const pat = /\s+|([A-Za-z_][\w]*)|(\()|(\))|(\[)|(\])|(\*)|(\+)|(\?)|(\|)|(:)/y;
  const kinds = ["IDENT", "LP", "RP", "LB", "RB", "STAR", "PLUS", "Q", "BAR", "COLON"] as const;
  const scan = (i: number, acc: Array<[string, string]>): Array<[string, string]> => {
    if (i >= s.length) {
      return acc;
    }
    pat.lastIndex = i;
    const m = pat.exec(s);
    if (!m) {
      throw new Error(`Bad grammar char at ${s.slice(i, i + 20)}`);
    }
    if (m[0].trim() === "") {
      return scan(pat.lastIndex, acc);
    }
    const idx = Array.from({ length: m.length - 1 }, (_, k) => k + 1).find((k) => !!m[k]);
    const token = idx ? ([kinds[idx - 1] as string, m[idx]!] as [string, string]) : undefined;
    const nextAcc = token ? [...acc, token] : acc;
    return scan(pat.lastIndex, nextAcc);
  };
  return scan(0, []);
}

function parseExpr(s: string): Node {
  const noComments = s
    .split(/\r?\n/)
    .map((ln) => ln.split("#", 1)[0])
    .filter((ln) => ln.trim() !== "")
    .join("\n");
  const gtoks = tokenizeExpr(noComments);

  const eat = (gi: number, kind: string): [string | null, number] => {
    if (gi < gtoks.length && gtoks[gi]![0] === kind) {
      const t = gtoks[gi]!;
      return [t[1]!, gi + 1];
    }
    return [null, gi];
  };

  const parseChoice = (gi: number): [Node, number] => {
    const [seq, gi2] = parseSeq(gi);
    const more = (gix: number, acc: Node[]): [Node, number] => {
      const [bar, giy] = eat(gix, "BAR");
      if (bar == null) {
        return acc.length === 1 ? [acc[0]!, gix] : [["CHOICE", acc] as Node, gix];
      }
      const [n, gk] = parseSeq(giy);
      return more(gk, [...acc, n]);
    };
    return more(gi2, [seq]);
  };

  const parseSeq = (gi: number): [Node, number] => {
    const step = (gix: number, acc: Node[]): [Node, number] => {
      const [prim, giy] = parsePostfix(gix);
      if (!prim) {
        if (acc.length === 0) { return [["EMPTY"], gix]; }
        if (acc.length === 1) { return [acc[0]!, gix]; }
        return [["SEQ", acc], gix];
      }
      if (giy < gtoks.length) {
        const k = gtoks[giy]![0];
        if (k === "RP" || k === "RB" || k === "BAR") {
          const acc2 = [...acc, prim];
          if (acc2.length === 1) { return [acc2[0]!, giy]; }
          return [["SEQ", acc2], giy];
        }
      }
      return step(giy, [...acc, prim]);
    };
    return step(gi, []);
  };

  const parsePostfix = (gi: number): [Node | null, number] => {
    const [prim, gi2] = parsePrimary(gi);
    if (!prim) { return [null, gi]; }
    if (gi2 < gtoks.length) {
      const k = gtoks[gi2]![0];
      if (k === "STAR" || k === "PLUS" || k === "Q") {
        const node: Node = k === "STAR" ? ["STAR", prim] : (k === "PLUS" ? ["PLUS", prim] : ["Q", prim]);
        return [node, gi2 + 1];
      }
    }
    return [prim, gi2];
  };

  const parsePrimary = (gi: number): [Node | null, number] => {
    const [lp, gi2] = eat(gi, "LP");
    if (lp != null) {
      const [inner, gi3] = parseChoice(gi2);
      const [rp, gi4] = eat(gi3, "RP");
      if (rp == null) { throw new Error("missing )"); }
      return [inner, gi4];
    }
    const [lb, gi5] = eat(gi, "LB");
    if (lb != null) {
      const [inner, gi6] = parseChoice(gi5);
      const [rb, gi7] = eat(gi6, "RB");
      if (rb == null) { throw new Error("missing ]"); }
      return [["Q", inner], gi7];
    }
    const [ident, gi8] = eat(gi, "IDENT");
    if (ident) {
      const [colon, gi9] = eat(gi8, "COLON");
      if (colon != null) {
        const [child, gi10] = parsePrimary(gi9);
        if (!child) { throw new Error("label without target"); }
        return [["LABEL", ident, child], gi10];
      }
      return [["SYM", ident], gi8];
    }
    return [null, gi];
  };

  const [expr, giEnd] = parseChoice(0);
  if (giEnd !== gtoks.length) {
    const leftover = gtoks.slice(giEnd, giEnd + 10);
    throw new Error(`Unused grammar tokens: ${JSON.stringify(leftover)}`);
  }
  return expr;
}

/** Build a PEG program (token set + rule ASTs + rule actions) from a KGF spec. */
export function buildPEG(spec: KGFSpec): PEG {
  const tokens = new Set(spec.tokens.filter((t) => !t.skip).map((t) => t.name));
  const ast: Record<string, Node> = {};
  for (const [name, rd] of Object.entries(spec.rules)) {
    ast[name] = parseExpr(rd.expr);
  }
  return { tokens, ast, attrs: spec.attrs };
}

type EvalRes = [ok: boolean, j: number, labels: Record<string, string | null | undefined>, events: Array<[string, Record<string, unknown>]>];

function memoKey(node: Node, i: number): string {
  return `${JSON.stringify(node)}@${i}`;
}

function evalNode(
  peg: PEG,
  node: Node,
  toks: Tok[],
  i: number,
  memo: Map<string, EvalRes>,
  callRule: (name: string, i: number) => EvalRes,
  ctx: ExecCtx,
): EvalRes {
  const key = memoKey(node, i);
  const cached = memo.get(key);
  if (cached) {
    return cached;
  }
  const typ = node[0];
  if (typ === "EMPTY") {
    const res: EvalRes = [true, i, {}, []];
    memo.set(key, res);
    return res;
  }
  if (typ === "SYM") {
    const name = node[1];
    if (peg.tokens.has(name)) {
      if (i < toks.length && toks[i]!.kind === name) {
        const tok = toks[i]!;
        const res: EvalRes = [true, i + 1, { _last: tok.text }, []];
        memo.set(key, res);
        return res;
      } else {
        const res: EvalRes = [false, i, {}, []];
        memo.set(key, res);
        return res;
      }
    } else {
      const res = callRule(name, i);
      memo.set(key, res);
      return res;
    }
  }
  if (typ === "SEQ") {
    const elems = node[1]! as Node[];
    const evalSeq = (
      idx: number,
      pos: number,
      labs: Record<string, string | null | undefined>,
      evs: Array<[string, Record<string, unknown>]>,
    ): EvalRes => {
      if (idx >= elems.length) {
        return [true, pos, labs, evs];
      }
      const r = evalNode(peg, elems[idx]!, toks, pos, memo, callRule, ctx);
      if (!r[0]) {
        return [false, pos, {}, []];
      }
      const nextLabs = { ...labs, ...r[2] };
      const nextEvs = [...evs, ...r[3]] as Array<[string, Record<string, unknown>]>;
      return evalSeq(idx + 1, r[1], nextLabs, nextEvs);
    };
    const out = evalSeq(0, i, {}, []);
    memo.set(key, out);
    return out;
  }
  if (typ === "CHOICE") {
    const choices = node[1]! as Node[];
    const found = choices.map((child) => evalNode(peg, child, toks, i, memo, callRule, ctx)).find((r) => r[0]);
    const res: EvalRes = found ?? [false, i, {}, []];
    memo.set(key, res);
    return res;
  }
  if (typ === "STAR" || typ === "PLUS") {
    const child = node[1]! as Node;
    const repeat = (pos: number, labels: Record<string, string | null | undefined>, events: Array<[string, Record<string, unknown>]>, cnt: number): EvalRes => {
      const r = evalNode(peg, child, toks, pos, memo, callRule, ctx);
      if (!r[0]) {
        if (typ === "PLUS" && cnt === 0) {
          return [false, i, {}, []];
        }
        return [true, pos, labels, events];
      }
      const merged = { ...labels, ...r[2] };
      const evs = [...events, ...r[3]] as Array<[string, Record<string, unknown>]>;
      return repeat(r[1], merged, evs, cnt + 1);
    };
    const res = repeat(i, {}, [], 0);
    memo.set(key, res);
    return res;
  }
  if (typ === "Q") {
    const r = evalNode(peg, node[1]! as Node, toks, i, memo, callRule, ctx);
    const res: EvalRes = r[0] ? r : [true, i, {}, []];
    memo.set(key, res);
    return res;
  }
  if (typ === "LABEL") {
    const name = node[1]! as string;
    const child = node[2]! as Node;
    const r = evalNode(peg, child, toks, i, memo, callRule, ctx);
    if (r[0]) {
      const lab: Record<string, string | null | undefined> & { _last?: string } = { ...r[2] };
      const v = lab._last;
      if (v != null) {
        lab[name] = v;
      } else if (!(name in lab)) {
        lab[name] = null;
      }
      const res: EvalRes = [true, r[1], lab, r[3]];
      memo.set(key, res);
      return res;
    }
    const res: EvalRes = [false, i, {}, []];
    memo.set(key, res);
    return res;
  }
  const res: EvalRes = [false, i, {}, []];
  memo.set(key, res);
  return res;
}

function applyAction(a: AttrAction, ctx: ExecCtx, lab: Record<string, unknown>): void {
  const kind = a.kind;
  const P = a.params;
  if (kind === "def") {
    const nmVal = lab[P["id"] as string];
    if (typeof nmVal !== "string" || nmVal.length === 0) { return; }
    const nm = nmVal;
    const ns = P["ns"] ?? "value";
    const skind = P["kind"] ?? "Symbol";
    ctx.symSeq += 1;
    const sid = `${ctx.file}::${ns}:${nm}#${ctx.symSeq}`;
    // Bind and record
    ctx.graph.symbols[sid] = { id: sid, name: nm, kind: skind, ns, module: ctx.file };
    const top = ctx.scopes[ctx.scopes.length - 1]!;
    if (ns === "value" || ns === "type") {
      top[ns][nm] = sid;
    }
    addEdge(ctx.graph, "declares", ctx.file, sid, { site: "top" });
    ctx.eventsTmp.push(["Def", { symbol: sid }]);
    return;
  }
  if (kind === "ref") {
    const nmVal = lab[P["name"] as string];
    if (typeof nmVal !== "string" || nmVal.length === 0) { return; }
    const nm = nmVal;
    const ns = P["ns"] ?? "value";
    const sid = [...ctx.scopes]
      .reverse()
      .map((frame) => (ns === "value" || ns === "type") ? frame[ns][nm] : undefined)
      .find((x) => typeof x === "string");
    if (sid) {
      addEdge(ctx.graph, "references", ctx.file, sid, { ref_kind: ns });
      ctx.eventsTmp.push(["Ref", { target: sid, ns }]);
    }
    return;
  }
  if (kind === "call") {
    const calVal = lab[P["callee"] as string];
    if (typeof calVal !== "string" || calVal.length === 0) { return; }
    const cal = calVal;
    const sid = [...ctx.scopes].reverse().map((fr) => fr.value[cal]).find((x) => typeof x === "string");
    ctx.callSeq += 1;
    const callId = `${ctx.file}::call@${ctx.callSeq}`;
    if (sid) {
      addEdge(ctx.graph, "calls", ctx.file, sid, { call_id: callId });
    } else {
      addEdge(ctx.graph, "calls", ctx.file, `${ctx.file}::value:${cal}?unresolved`, { call_id: callId });
    }
    ctx.callStack.push(callId);
    ctx.eventsTmp.push(["Call", { call_id: callId, calleeSym: sid ?? cal }]);
    return;
  }
  if (kind === "argref") {
    const idxStr = P["index"]; // optional index hint
    const idx = idxStr && /^(\d+)$/.test(idxStr) ? Number.parseInt(idxStr, 10) : 0;
    const refs = ctx.eventsTmp
      .filter((e) => e[0] === "Ref")
      .map((e) => e[1])
      .filter((x): x is { target: string } => typeof (x as { target?: unknown }).target === "string");
    const call = ctx.callStack.length > 0 ? ctx.callStack[ctx.callStack.length - 1] : null;
    for (const r of refs) {
      addEdge(ctx.graph, "argumentUses", ctx.file, r.target, { arg_index: idx, call: call ?? undefined });
      ctx.eventsTmp.push(["ArgRef", { target: r.target, index: idx, call: call ?? undefined }]);
    }
    // Clear collected refs so next argref won’t duplicate
    ctx.eventsTmp = ctx.eventsTmp.filter((e) => e[0] !== "Ref");
    return;
  }
  if (kind === "import") {
    const modVal = lab[P["module"] as string];
    if (typeof modVal !== "string" || modVal.length === 0) { return; }
    const mod = modVal;
    const to = resolveModule(ctx.spec.resolver, ctx.spec.language, ctx.file, mod, ctx.root);
    if (!ctx.graph.modules[to]) {
      ctx.graph.modules[to] = { id: to, file: to.includes(":") ? null : to };
    }
    addEdge(ctx.graph, "moduleDependsOn", ctx.file, to, { via: mod, dep_kind: "value" });
    ctx.eventsTmp.push(["Import", { module: to }]);
    return;
  }
  if (kind === "import_bind") {
    // Bind a locally imported alias to a symbol in the resolved external module
    const modVal = lab[P["module"] as string];
    const importVal = lab[P["import"] as string];
    const localVal = lab[P["local"] as string];
    const ns = P["ns"] ?? "value";
    if (typeof modVal !== "string" || typeof importVal !== "string" || typeof localVal !== "string") {
      return;
    }
    const to = resolveModule(ctx.spec.resolver, ctx.spec.language, ctx.file, modVal, ctx.root);
    if (!ctx.graph.modules[to]) {
      ctx.graph.modules[to] = { id: to, file: to.includes(":") ? null : to };
    }
    const targetSym = `${to}::${ns}:${importVal}`;
    const top = ctx.scopes[ctx.scopes.length - 1]!;
    if (ns === "value" || ns === "type") {
      top[ns][localVal] = targetSym;
    }
    addEdge(ctx.graph, "importsSymbol", ctx.file, targetSym, { local: localVal, imported: importVal, module: to });
    ctx.eventsTmp.push(["ImportBind", { local: localVal, imported: importVal, module: to }]);
    return;
  }
  if (kind === "reexport") {
    const modVal = lab[P["module"] as string];
    if (typeof modVal !== "string" || modVal.length === 0) { return; }
    const mod = modVal;
    const to = resolveModule(ctx.spec.resolver, ctx.spec.language, ctx.file, mod, ctx.root);
    if (!ctx.graph.modules[to]) {
      ctx.graph.modules[to] = { id: to, file: to.includes(":") ? null : to };
    }
    addEdge(ctx.graph, "reexports", ctx.file, to, undefined);
    ctx.eventsTmp.push(["Reexport", { module: to }]);
    return;
  }
  if (kind === "scope") {
    if (P["push"]) {
      ctx.scopes.push({ value: {}, type: {} });
    }
    if (P["pop"]) {
      if (ctx.scopes.length > 1) {
        ctx.scopes.pop();
      }
    }
    return;
  }
  if (kind === "call_end") {
    if (ctx.callStack.length > 0) {
      ctx.callStack.pop();
    }
    return;
  }
  if (kind === "arg_begin" || kind === "arg_end") {
    // Minimal runtime: markers only; collection handled by argref step
    return;
  }
}

/** Execute the PEG program from a start rule over tokens, emitting rule events. */
export function runParse(
  peg: PEG,
  spec: KGFSpec,
  startRule: string,
  toks: Tok[],
  ctx: ExecCtx,
): [Record<string, string | null | undefined>, Array<[string, Record<string, unknown>]>] {
  const memo = new Map<string, EvalRes>();

  const callRule = (name: string, pos: number): EvalRes => {
    const node = peg.ast[name];
    const before = ctx.eventsTmp.length;
    const r = evalNode(peg, node, toks, pos, memo, callRule, ctx);
    if (!r[0]) {
      return [false, pos, {}, []];
    }
    const acts = peg.attrs[name] ?? [];
    for (const a of acts) {
      applyAction(a, ctx, r[2]);
    }
    const ruleEvents = ctx.eventsTmp.slice(before);
    return [true, r[1], r[2], ruleEvents];
  };

  const root = peg.ast[startRule];
  const before = ctx.eventsTmp.length;
  const r = evalNode(peg, root, toks, 0, memo, callRule, ctx);
  if (!r[0]) {
    throw new Error("parse failed at token index 0");
  }
  // Apply actions for start rule as well
  const startActs = peg.attrs[startRule] ?? [];
  for (const a of startActs) {
    applyAction(a, ctx, r[2]);
  }
  const events = ctx.eventsTmp.slice(before);
  return [r[2], events];
}
