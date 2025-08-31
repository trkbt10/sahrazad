/**
 * @file Unit tests for custom embedder (unified function interface).
 */
import { createCustomEmbedder } from "./provider-custom";

describe("createCustomEmbedder", () => {
  it("wraps embedMany when embedOne missing", async () => {
    const embedMany = createCustomEmbedder({
      embedMany: async (inputs) => inputs.map((t) => [t.length, 1, 2, 3]),
    });
    const many = await embedMany(["a", "abcd"]);
    expect(many).toEqual([[1, 1, 2, 3], [4, 1, 2, 3]]);
  });

  it("wraps embedOne to build embedMany when embedMany missing", async () => {
    const embedMany = createCustomEmbedder({
      embedOne: async (input) => [input.length, 0],
    });
    const many = await embedMany(["a", "bb"]);
    expect(many).toEqual([[1, 0], [2, 0]]);
  });

  it("throws if neither provided", async () => {
    expect(() => createCustomEmbedder({})).toThrow();
  });
});
