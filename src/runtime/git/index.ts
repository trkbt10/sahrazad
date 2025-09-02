/** @file Public exports for git runtime (explicit, no export *). */

// Types
export type {
  GitHash,
  GitRepo,
  GitHeadInfo,
  GitWatchOptions,
  GitWatchHandlers,
  GitWatchStop,
} from './types';

// Repo API
export { createGitRepo } from './repo';

// HEAD helpers
export { parseHeadContent, readHeadInfo } from './head';

// Watcher API
export { watchGit } from './watcher';

// Strategies (re-export from shared watch module for DI-ready behavior)
export { FsWatchStrategy } from '../watch';
