/**
 * @file Public exports for core recall framework.
 */
export type { CoreIngestConfig, RecallQueryArgs } from "./types";
export { toKnowledgeGraph, indexPathsWithKGF } from "./kgf-ingest";
export { createIngestPipeline } from "./pipeline";
export { createRecallQueryApi } from "./query";
export { startFsWatch, startGitWatch } from "./watchers";
export { createTaskAssist } from "./task-assist";
export { validateVectorClient, validateIngestConfig } from "./validate";
