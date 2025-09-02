/**
 * @file Unit tests for graph helper functions (createGraph, getOrAddModule, getOrAddSymbol, addEdge, toJSON).
 */
import { createGraph, getOrAddModule, getOrAddSymbol, addEdge, toJSON } from "./graph";

describe("graph helpers", () => {
  it("creates modules, symbols and edges, and serializes to JSON", () => {
    const g = createGraph();
    const mod = getOrAddModule(g, "src/main.ts", "src/main.ts");
    expect(mod.id).toBe("src/main.ts");

    const sym = getOrAddSymbol(g, "src/main.ts::value:foo#1", "foo", "Var", "value", mod.id);
    expect(sym.name).toBe("foo");

    addEdge(g, "declares", mod.id, sym.id, { site: "top" });
    const json = toJSON(g);

    expect(Object.keys(json.modules)).toContain("src/main.ts");
    expect(Object.keys(json.symbols)).toContain("src/main.ts::value:foo#1");
    expect(json.edges.some((e) => e.kind === "declares")).toBe(true);
  });
});

