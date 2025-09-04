/**
 * @file Tests for KGF -> KnowledgeGraph conversion.
 */
import { createGraph, getOrAddModule, getOrAddSymbol, addEdge } from "../../runtime/kgf/graph";
import { toKnowledgeGraph } from "./kgf-ingest";

describe("toKnowledgeGraph", () => {
  it("maps modules/symbols and edges to KnowledgeGraph", () => {
    const kg = createGraph();
    const mod = getOrAddModule(kg, "src/main.ts", "src/main.ts");
    const sym = getOrAddSymbol(kg, `${mod.id}::value:foo#1`, "foo", "Var", "value", mod.id);
    addEdge(kg, "declares", mod.id, sym.id, { site: "top" });

    const g = toKnowledgeGraph(kg);
    const fileId = "file://src/main.ts";
    const symId = `symbol://${sym.id}`;

    expect(g.nodes.has(fileId)).toBe(true);
    expect(g.nodes.has(symId)).toBe(true);
    expect(g.edges.some((e) => e.type === "CONTAINS")).toBe(true);
    const e = g.edges.find((e) => e.type === "CONTAINS");
    expect(e?.from).toBe(fileId);
    expect(e?.to).toBe(symId);
  });
});
