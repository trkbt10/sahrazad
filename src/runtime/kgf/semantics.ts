/**
 * @file Semantics DSL evaluator for KGF. Minimal implementation per SPEC.md.
 */
import { addEdge } from "./graph";
import type { CodeGraph } from "./graph";
import type { KGFSpec, SemExpr, SemOnBlock, SemStmt } from "./types";
import { resolveModule } from "./resolver";

type Env = {
  labels: Record<string, unknown>;
  locals: Record<string, unknown>;
};

export type SemEvalCtx = {
  spec: KGFSpec;
  graph: CodeGraph;
  file: string;
  root: string;
  language: string;
  scopes: Array<Record<"value" | "type", Record<string, string>>>;
  symSeq: { n: number };
  callSeq: { n: number };
  callStack: string[];
  eventsTmp: Array<[string, Record<string, unknown>]>;
};

function isTruthy(v: unknown): boolean {
  if (v === null || v === undefined) {
    return false;
  }
  if (typeof v === "boolean") {
    return v;
  }
  if (typeof v === "string") {
    return v.length > 0;
  }
  if (Array.isArray(v)) {
    return v.length > 0;
  }
  return true;
}

function evalExpr(expr: SemExpr, env: Env, ctx: SemEvalCtx): unknown {
  if (expr.kind === "str") {
    return expr.value;
  }
  if (expr.kind === "num") {
    return expr.value;
  }
  if (expr.kind === "bool") {
    return expr.value;
  }
  if (expr.kind === "null") {
    return null;
  }
  if (expr.kind === "var") {
    const n = expr.name;
    if (n === "file") { return ctx.file; }
    if (n === "root") { return ctx.root; }
    if (n === "language") { return ctx.language; }
    if (n in env.locals) { return env.locals[n]; }
    return env.labels[n];
  }
  if (expr.kind === "call") {
    const name = expr.name;
    const args = expr.args.map((e) => evalExpr(e, env, ctx));
    if (name === "resolve") {
      const mod = String(args[0] ?? "");
      return resolveModule(ctx.spec.resolver, ctx.language, ctx.file, mod, ctx.root);
    }
    if (name === "scope") {
      const ns = String(args[0] ?? "value");
      const id = String(args[1] ?? "");
      const found = [...ctx.scopes]
        .reverse()
        .map((fr) => (ns === "value" || ns === "type") ? fr[ns][id] : undefined)
        .find((x) => typeof x === "string");
      return found ?? null;
    }
    if (name === "callId") {
      return ctx.callStack.length > 0 ? ctx.callStack[ctx.callStack.length - 1] : null;
    }
    if (name === "autoSym") {
      ctx.symSeq.n += 1; return String(ctx.symSeq.n);
    }
    if (name === "autoCall") {
      ctx.callSeq.n += 1; return String(ctx.callSeq.n);
    }
    if (name === "collectRefs") {
      const refs = ctx.eventsTmp.filter((e) => e[0] === "Ref").map((e) => e[1]);
      ctx.eventsTmp = ctx.eventsTmp.filter((e) => e[0] !== "Ref");
      return refs;
    }
    return null;
  }
  if (expr.kind === "func") {
    const name = expr.name;
    const args = expr.args.map((e) => evalExpr(e, env, ctx));
    if (name === "concat") {
      return args.map((x) => String(x ?? "")).join("");
    }
    if (name === "obj") {
      const pairs = args;
      const N = pairs.length;
      const build = (idx: number, acc: Record<string, unknown>): Record<string, unknown> => {
        if (idx >= N) { return acc; }
        const key = String(pairs[idx] ?? "");
        const val = idx + 1 < N ? pairs[idx + 1] : null;
        return build(idx + 2, { ...acc, [key]: val });
      };
      return build(0, {});
    }
    if (name === "coalesce") {
      return args[0] ?? args[1] ?? null;
    }
    return null;
  }
  return null;
}

function evalStmt(stmt: SemStmt, env: Env, ctx: SemEvalCtx): void {
  if (stmt.kind === "edge") {
    const kind = stmt.edgeKind;
    const from = String(evalExpr(stmt.from, env, ctx) ?? "");
    const to = String(evalExpr(stmt.to, env, ctx) ?? "");
    const attrsVal = stmt.attrs ? evalExpr(stmt.attrs, env, ctx) : undefined;
    const attrs = (attrsVal && typeof attrsVal === "object") ? (attrsVal as Record<string, unknown>) : undefined;
    addEdge(ctx.graph, kind, from, to, attrs);
    return;
  }
  if (stmt.kind === "bind") {
    const ns = String(evalExpr(stmt.ns, env, ctx) ?? "value");
    const name = String(evalExpr(stmt.name, env, ctx) ?? "");
    const to = String(evalExpr(stmt.to, env, ctx) ?? "");
    const top = ctx.scopes[ctx.scopes.length - 1]!;
    if (ns === "value" || ns === "type") {
      top[ns][name] = to;
    }
    return;
  }
  if (stmt.kind === "note") {
    const payload = stmt.payload ? evalExpr(stmt.payload, env, ctx) : undefined;
    ctx.eventsTmp.push(["Note", { type: stmt.noteType, payload }]);
    return;
  }
  if (stmt.kind === "let") {
    const v = evalExpr(stmt.value, env, ctx);
    env.locals[stmt.id] = v;
    return;
  }
  if (stmt.kind === "for") {
    const arr = evalExpr(stmt.iter, env, ctx);
    if (Array.isArray(arr)) {
      for (const item of arr) {
        env.locals[stmt.id] = item;
        for (const s of stmt.body) {
          evalStmt(s, env, ctx);
        }
      }
    }
    return;
  }
}

/** Evaluate semantics on-blocks for a completed rule with captured labels. */
export function evalSemantics(blocks: SemOnBlock[] | undefined, labels: Record<string, unknown>, ctx: SemEvalCtx): void {
  if (!blocks || blocks.length === 0) {
    return;
  }
  const env: Env = { labels, locals: {} };
  for (const b of blocks) {
    const cond = b.when ? isTruthy(evalExpr(b.when, env, ctx)) : true;
    const stmts = cond ? b.then : (b.else ?? []);
    for (const s of stmts) {
      evalStmt(s, env, ctx);
    }
  }
}
