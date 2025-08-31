/**
 * @file Xenova/transformers-style embedding provider (sentence-transformers).
 *
 * Notes:
 * - We avoid hard dependency by using an injected importer. This keeps env explicit and testable.
 */
import type { EmbedMany, Embedding } from "./types";

type XenovaModule = {
  pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<
    (text: string, opts?: Record<string, unknown>) => Promise<{ data: number[] | Float32Array }>
  >;
};

export type XenovaImporter = () => Promise<XenovaModule>;

/**
 * Create an embedder backed by a Xenova/transformers feature-extraction pipeline.
 *
 * Caller must inject an importer that returns the module implementing `pipeline`.
 */
export function createXenovaEmbedder({
  model,
  importer,
  quantized = true,
  pooling = "mean",
  normalize = true,
}: {
  model: string;
  importer: XenovaImporter;
  quantized?: boolean;
  pooling?: "mean" | "max";
  normalize?: boolean;
}): EmbedMany {
  if (!model || model.length === 0) {
    throw new Error("createXenovaEmbedder: 'model' is required");
  }
  if (!importer) {
    throw new Error("createXenovaEmbedder: 'importer' is required");
  }

  const cache = { extractorPromise: null as null | Promise<(text: string, opts?: Record<string, unknown>) => Promise<{ data: number[] | Float32Array }>> };
  async function getExtractor() {
    if (cache.extractorPromise !== null) { return cache.extractorPromise; }
    const p = (async () => {
      const mod = await importer();
      return mod.pipeline("feature-extraction", model, { quantized });
    })();
    cache.extractorPromise = p;
    return p;
  }

  async function embedOne(input: string): Promise<Embedding> {
    if (!input || input.length === 0) {
      throw new Error("embedOne: 'input' (non-empty string) is required");
    }
    const extractor = await getExtractor();
    const res = await extractor(input, { pooling, normalize });
    const data = Array.isArray(res.data) ? res.data : Array.from(res.data);
    return data;
  }

  async function embedMany(inputs: ReadonlyArray<string>): Promise<ReadonlyArray<Embedding>> {
    if (!inputs || inputs.length === 0) {
      throw new Error("embedMany: 'inputs' (non-empty array) is required");
    }
    const out: Embedding[] = [];
    for (const t of inputs) {
      const vec = await embedOne(t);
      out.push(vec);
    }
    return out;
  }

  return embedMany;
}
