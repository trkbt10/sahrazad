/**
 * @file Embedding model constants and helpers.
 */

// Embedding models we support in this project.
export type EmbeddingModelName =
  | "text-embedding-3-small"
  | "text-embedding-3-large"
  | "text-embedding-ada-002";

// Dimensions per model (source: OpenAI embeddings docs).
export const EMBEDDING_DIMENSIONS: Record<EmbeddingModelName, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
} as const;

/**
 * Get the embedding vector size for a given model.
 */
export function getEmbeddingDimension(model: EmbeddingModelName): number {
  return EMBEDDING_DIMENSIONS[model];
}

