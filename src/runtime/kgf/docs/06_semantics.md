# Semantics Section (DSL)

Purpose

- Provide a general way to map rule/label data into graph edges/bindings/notes. `semantics` complements (does not replace) `attrs` and is evaluated after `attrs` on each successful rule.

On‑blocks

```
on <RuleName> { ... }
on <RuleName> when <Expr> { ... } else { ... }
```

- `when` is optional; when false, the `else` block (if present) runs.

Statements

- `edge <kind> from <Expr> to <Expr> attrs <Expr?>`
- `bind ns <Expr> name <Expr> to <Expr>`
- `note <type> payload <Expr?>`
- `let <id> = <Expr>`
- `for <id> in <Expr> { ... }` (minimal foreach; arrays only)

Expressions

- Literals: strings (`"text"`), numbers, `true`/`false`, `null`
- Variables: `$label`, `$file`, `$root`, `$language`
- Calls: `$resolve(module)`, `$scope(ns, name)`, `$callId()`, `$autoSym()`, `$autoCall()`, `$collectRefs()`
- Functions: `concat(a, b, ...)`, `obj(k1, v1, k2, v2, ...)`, `coalesce(a, b)`

Evaluation order

1) A rule matches → execute its `attrs` in order.
2) Evaluate all `on <Rule>` blocks in `semantics` for that rule, in file order.
3) After the start rule returns, also evaluate `attrs` and `semantics` for the start rule.

Binding & resolution

- `bind ns` writes into the current scope frame; supported namespaces are `value` and `type`.
- `edge` requires `from`/`to` to be string ids (module ids or symbol ids).
- `$resolve` follows the `resolver` rules; unresolved non‑relative returns `bare_prefix + head`.
- `$scope` searches from innermost to outermost scopes for a symbol id in the given namespace.

Examples

Declare + Ref in one block:

```
on Start {
  let nm = $a
  let sid = concat($file, "::value:", nm, "#", $autoSym())
  bind ns "value" name nm to sid
  edge declares from $file to sid attrs obj("site", "top")
  let rsid = $scope("value", $b)
  edge references from $file to rsid attrs obj("ref_kind", "value")
}
```

Import dependency:

```
on ImportStmt {
  let to = $resolve($module)
  edge moduleDependsOn from $file to to attrs obj("via", $module, "dep_kind", "value")
}
```

Notes

- This is a minimal DSL intended for resilient mapping. Prefer simple compositions over complex control flow.
- `attrs` and `semantics` are additive (“augment”); `semantics` does not suppress default edges.

