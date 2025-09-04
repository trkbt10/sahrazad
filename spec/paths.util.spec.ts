/**
 * @file Tests for core/domain/paths utilities.
 */
import { toPosix, relFromRepo, isUnderDir, stripPrefix, listImmediateChildren } from "../src/core/domain/paths";
import { createKnowledgeGraphStore } from "../src/services/knowledge-graph/graph";

describe("paths util", () => {
  it("normalizes and computes repo-relative", () => {
    expect(toPosix("a\\b/c")).toBe("a/b/c");
    const repo = "/repo";
    expect(relFromRepo(repo, "/repo/src/a.ts")).toBe("src/a.ts");
  });

  it("checks scope and strips prefix", () => {
    expect(isUnderDir("src/a.ts", "src/")).toBe(true);
    expect(isUnderDir("src2/a.ts", "src/")).toBe(false);
    expect(stripPrefix("src/a.ts", "src/")).toBe("a.ts");
  });

  it("lists immediate children from graph", () => {
    const g = createKnowledgeGraphStore();
    g.upsertNode({ id: "file://src/a.ts", type: "File", props: { path: "src/a.ts" } });
    g.upsertNode({ id: "file://src/dir/b.ts", type: "File", props: { path: "src/dir/b.ts" } });
    const out = listImmediateChildren(g, "src/");
    expect(out.files).toEqual(["a.ts"]);
    expect(out.dirs).toEqual(["dir"]);
  });
});
