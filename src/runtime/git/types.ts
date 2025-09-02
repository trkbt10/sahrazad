/** @file Types for the git runtime abstraction and watcher (callback-driven, strategy-agnostic) */
import type { CommitResult, SimpleGit, StatusResult } from 'simple-git';

export type GitHash = string;

export type GitRepo = {
  readonly root: string;
  readonly git: SimpleGit;
  currentBranch(): Promise<string>;
  headCommit(): Promise<GitHash>;
  status(): Promise<StatusResult>;
  add(paths: string | string[]): Promise<void>;
  commit(message: string, paths?: string | string[]): Promise<CommitResult>;
  revParse(arg: string): Promise<string>;
};

export type GitHeadInfo =
  | { kind: 'ref'; ref: string }
  | { kind: 'hash'; hash: GitHash };

export type GitWatchOptions = {
  readonly debounceMs: number;
  readonly enrich: boolean;
};

export type GitWatchHandlers = {
  onHead: (head: GitHeadInfo) => void;
  onRef: (branch: string, hash?: GitHash) => void;
  onIndex: () => void;
  onReady?: () => void;
  onClose?: () => void;
  onError?: (err: unknown) => void;
};

export type GitWatchStop = () => Promise<void>;
