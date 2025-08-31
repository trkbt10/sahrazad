/**
 * @file Unit tests for Xenova embedder (unified function interface).
 */
import { createXenovaEmbedder, type XenovaImporter } from "./provider-xenova";

describe("createXenovaEmbedder", () => {
  it("throws on missing model", () => {
    const importer: XenovaImporter = async () => {
      return {
        pipeline: async () => {
          return async () => ({ data: new Float32Array([0]) });
        },
      };
    };
    expect(() => createXenovaEmbedder({ model: "", importer })).toThrow();
  });

  it("embeds using provided importer/pipeline", async () => {
    const importer: XenovaImporter = async () => {
      return {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature parity with real pipeline
        pipeline: async (_task: string, _model: string) => {
          return async (text: string) => ({ data: new Float32Array([text.length, 42]) });
        },
      };
    };
    const embedMany = createXenovaEmbedder({ model: "sentence-transformers/all-MiniLM-L6-v2", importer });
    const out = await embedMany(["a", "abcd"]);
    expect(out).toEqual([[1, 42], [4, 42]]);
  });
});
