/**
 * @file Tests for extracting endpoints from a ServerSpec (implementation-agnostic).
 */
import { extractEndpointsFromSpec } from "./endpoints";
import type { ServerSpec } from "./schema";

describe("extractEndpointsFromSpec", () => {
  it("returns sorted unique METHOD path strings and includes /health", () => {
    const spec: ServerSpec = {
      items: [
        { type: "tool", name: "recall", description: "r", input_schema: {}, routes: { method: "GET", path: "/a" } },
        { type: "tool", name: "ingestPaths", description: "i", input_schema: {}, routes: [
          { method: "POST", path: "/b" },
          { method: "POST", path: "/b" }, // duplicate for uniqueness test
        ] },
      ],
    };

    const eps = extractEndpointsFromSpec(spec);
    expect(eps).toEqual(["GET /a", "GET /health", "POST /b"]);
  });
});
