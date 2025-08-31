/**
 * @file Shared embedding types.
 */

/** A single embedding vector. */
export type Embedding = ReadonlyArray<number>;

/** Unified embedding function interface (batch only). */
export type EmbedMany = (inputs: ReadonlyArray<string>) => Promise<ReadonlyArray<Embedding>>;
