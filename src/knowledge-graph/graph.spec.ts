/**
 * @file Tests for KnowledgeGraph store behavior and JSON roundtrip.
 */
import { createKnowledgeGraphStore, knowledgeGraphFromJSON } from "./graph";

describe("KnowledgeGraphStore", () => {
  it("adds, upserts, and removes nodes and edges", () => {
    const g = createKnowledgeGraphStore();
    const file = { id: "file://a.ts", type: "File" as const, props: { path: "a.ts" } };
    const sym = {
      id: "symbol://a.ts#function:foo",
      type: "Symbol" as const,
      props: { path: "a.ts", kind: "function", name: "foo" },
    };

    g.addNode(file);
    g.upsertNode({ ...file, props: { path: "a.ts", lang: ".ts" } });
    g.addNode(sym);
    g.addEdge({ from: file.id, to: sym.id, type: "CONTAINS" });

    expect(g.nodes.size).toBe(2);
    expect(g.edges.length).toBe(1);

    const neigh = g.neighbors(file.id, "out");
    expect(neigh[0]?.to).toBe(sym.id);

    g.removeNode(sym.id);
    expect(g.nodes.size).toBe(1);
    expect(g.edges.length).toBe(0);
  });

  it("serializes and restores via JSON", () => {
    const g = createKnowledgeGraphStore();
    const file = { id: "file://b.ts", type: "File" as const, props: { path: "b.ts" } };
    g.addNode(file);
    const j = g.toJSON();
    const g2 = knowledgeGraphFromJSON(j);
    expect(g2.nodes.get(file.id)?.props.path).toBe("b.ts");
  });
});

