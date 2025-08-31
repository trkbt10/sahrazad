/**
 * @file Custom embedding adapter allowing arbitrary functions.
 */
import type { EmbedMany, Embedding } from "./types";

/**
 * Create an embedder from user-provided functions.
 * - Provide either `embedMany` or `embedOne` (or both).
 * - Preserves order for `embedMany` and validates inputs explicitly.
 */
export function createCustomEmbedder(args: {
  embedMany?: EmbedMany;
  embedOne?: (input: string) => Promise<Embedding>;
}): EmbedMany {
  const { embedMany, embedOne } = args ?? {};
  if (!embedMany && !embedOne) {
    throw new Error("createCustomEmbedder: provide 'embedMany' or 'embedOne'");
  }

  const callEmbedOne = async (input: string) => {
    if (input === undefined || input === null || input.length === 0) {
      throw new Error("embedOne: 'input' (non-empty string) is required");
    }
    if (embedOne) {
      return embedOne(input);
    }
    if (!embedMany) {
      throw new Error("embedOne: no implementation");
    }
    const out = await embedMany([input]);
    const first = out[0];
    if (!first) {
      throw new Error("embedOne: underlying embedMany returned empty result");
    }
    return first;
  };

  const callEmbedMany: EmbedMany = async (inputs) => {
    if (!inputs || inputs.length === 0) {
      throw new Error("embedMany: 'inputs' (non-empty array) is required");
    }
    if (embedMany) {
      return embedMany(inputs);
    }
    if (!embedOne) {
      throw new Error("embedMany: no implementation");
    }
    const result: Embedding[] = [];
    for (const t of inputs) {
      // Sequential to preserve order; callers can parallelize if desired.
      const vec = await callEmbedOne(t);
      result.push(vec);
    }
    return result;
  };

  return callEmbedMany;
}
