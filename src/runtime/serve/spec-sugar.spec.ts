/**
 * @file Tests for minimal-config ServerSpec helper (ensureServerSpec).
 */
import { ensureServerSpec } from "./spec-sugar";

describe("ensureServerSpec", () => {
  it("throws when routes missing and autoRoutes disabled", () => {
    expect(() => ensureServerSpec({ items: [
      { type: "tool", name: "recall", description: "d", input_schema: {} },
    ] })).toThrow();
  });

  it("adds default POST /api/:name when features.restful enabled", () => {
    const spec = ensureServerSpec({ items: [
      { type: "tool", name: "recall", description: "d", input_schema: {} },
      { type: "tool", name: "ingestPaths", description: "d", input_schema: {}, routes: { method: "POST", path: "/custom" } },
    ] }, { features: { restful: true } });

    expect(spec.items.length).toBe(2);
    const a = spec.items[0];
    const b = spec.items[1];
    if (a.type === "tool") {
      const arr = Array.isArray(a.routes) ? a.routes : [a.routes];
      expect(arr[0]).toEqual({ method: "POST", path: "/api/recall" });
    } else {
      throw new Error("expected tool");
    }
    if (b.type === "tool") {
      const arr = Array.isArray(b.routes) ? b.routes : [b.routes];
      expect(arr[0]).toEqual({ method: "POST", path: "/custom" });
    } else {
      throw new Error("expected tool");
    }
  });
});
