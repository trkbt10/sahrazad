/**
 * @file Unit tests for OpenAI embedder (unified function interface).
 */
import { createOpenAIEmbedder } from "./provider-openai";

describe("createOpenAIEmbedder", () => {
  it("throws on missing args", () => {
    // @ts-expect-error - intentional runtime arg validation
    expect(() => createOpenAIEmbedder({ client: undefined, model: "text-embedding-3-small" })).toThrow();
  });

  it("calls OpenAI embeddings.create with model and input", async () => {
    const counter = { n: 0 };
    const client = {
      embeddings: {
        create: async (args: { model: string; input: string | readonly string[] }) => {
          counter.n += 1;
          const arr = Array.isArray(args.input) ? args.input : [args.input];
          return { data: arr.map(() => ({ embedding: [1, 2, 3] })) };
        },
      },
    };
    const embedMany = createOpenAIEmbedder({ client, model: "text-embedding-3-small" });
    const out = await embedMany(["a", "b"]);
    expect(out).toEqual([[1, 2, 3], [1, 2, 3]]);
    expect(counter.n).toBe(1);
  });
});
