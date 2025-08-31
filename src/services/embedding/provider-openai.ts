/**
 * @file OpenAI embedding provider.
 */
import type { EmbeddingModelName } from "../../constants/embedding-models";
import type { EmbedMany } from "./types";

/**
 * Minimal structural typing for an OpenAI-like embeddings client.
 */
type OpenAIEmbeddingsLike = {
  embeddings: {
    create: (args: { model: string; input: string | ReadonlyArray<string> }) => Promise<{
      data: { embedding: number[] }[];
    }>;
  };
};

/**
 * Create an OpenAI-based embedder.
 * - Does not read environment variables; caller provides the client.
 * - Requires explicit arguments; throws when missing.
 */
export function createOpenAIEmbedder({
  client,
  model,
}: {
  client: OpenAIEmbeddingsLike;
  model: EmbeddingModelName;
}): EmbedMany {
  /** Validate required arguments. */
  if (client === undefined || client === null) {
    throw new Error("createOpenAIEmbedder: 'client' is required");
  }
  if (model === undefined || model === null || model.length === 0) {
    throw new Error("createOpenAIEmbedder: 'model' is required");
  }

  const embedMany: EmbedMany = async (inputs) => {
    if (inputs === undefined || inputs === null || inputs.length === 0) {
      throw new Error("embedMany: 'inputs' (non-empty array) is required");
    }

    const items = [...inputs];
    const response = await client.embeddings.create({
      model,
      input: items,
    });

    return response.data.map((d) => d.embedding);
  };

  return embedMany;
}
