/**
 * @file Unified embedding interface exports and provider factories.
 */
export { createOpenAIEmbedder } from "./provider-openai";
export { createXenovaEmbedder } from "./provider-xenova";
export { createCustomEmbedder } from "./provider-custom";
export type { Embedding, EmbedMany } from "./types";
