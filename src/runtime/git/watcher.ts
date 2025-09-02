/** @file Git change watcher: callback-based, state-driven with explicit effects */
import { join, relative } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { GitRepo, GitWatchOptions, GitWatchHandlers, GitWatchStop } from './types';
import type { WatchStrategy, WatchHandle } from '../watch/types';
import { readHeadInfo } from './head';
import { FsWatchStrategy } from '../watch';

/** Validate and normalize git watcher options. */
export function ensureOptions(o: Partial<GitWatchOptions> | undefined): GitWatchOptions {
  if (!o) {
    throw new Error('GitWatcherOptions are required');
  }
  const debounceMs = o.debounceMs ?? 100;
  const enrich = o.enrich ?? true;
  return { debounceMs, enrich };
}

/** Start watching a repo and deliver events via callbacks. Returns stop function. */
export function watchGit(
  repo: GitRepo,
  options: Partial<GitWatchOptions>,
  handlers: GitWatchHandlers,
  strategy?: WatchStrategy,
): GitWatchStop {
  const opts = ensureOptions(options);
  const watchStrategy = strategy ?? FsWatchStrategy;
  const handleRef: { current: WatchHandle | null } = { current: null };
  const stateRef: { headRefPath: string | null } = { headRefPath: null };
  const debounceRef: { t: ReturnType<typeof setTimeout> | null } = { t: null };

  const emitError = (error: unknown): void => emitOrThrow(handlers.onError, error);

  async function onFsSignal(_signal: 'touched', filePath: string): Promise<void> {
    const rel = relative(repo.root, filePath);
    if (rel.endsWith('/HEAD') || rel === '.git/HEAD') {
      try {
        const head = await readHeadInfo(repo.root);
        await refreshHeadState(stateRef, repo.root, head);
        handlers.onHead(head);
        await reconfigure();
        return;
      } catch (error) {
        emitError(error);
        throw error; // Not recoverable here; propagate to caller
      }
    }

    if (rel.includes('/refs/heads/') || rel.startsWith('.git/refs/heads/')) {
      const branch = rel.split('/refs/heads/')[1] ?? '';
      if (opts.enrich) {
        const res = await resolveBranchHash({ revParse: repo.revParse }, branch, filePath, opts.debounceMs, debounceRef);
        if (res.ok) {
          handlers.onRef(branch, res.hash);
          return;
        }
        emitError(res.error);
        handlers.onRef(branch);
        return;
      }
      handlers.onRef(branch);
      return;
    }

    if (rel.endsWith('/index') || rel === '.git/index') {
      handlers.onIndex();
    }
  }

  // internal helpers now exported for testing (see below for exports)

  async function reconfigure(): Promise<void> {
    if (handleRef.current !== null) {
      const h = handleRef.current;
      handleRef.current = null;
      await h.close();
    }
    const root = repo.root;
    const head = join(root, '.git', 'HEAD');
    const refsDir = join(root, '.git', 'refs', 'heads');
    const index = join(root, '.git', 'index');
    const packedRefs = join(root, '.git', 'packed-refs');
    const targets: string[] = [head, refsDir, index, packedRefs];
    if (stateRef.headRefPath !== null) {
      targets.push(stateRef.headRefPath);
    }
    handleRef.current = watchStrategy.start(
      targets,
      (signal: 'touched', p: string) => {
        void signal;
        onFsSignal('touched', p).catch(emitError);
      },
      () => {
        if (handlers.onReady) {
          handlers.onReady();
        }
      },
      emitError,
    );
  }

  // Initialize state from current HEAD and configure watchers accordingly
  Promise.resolve()
    .then(() => refreshHeadState(stateRef, repo.root))
    .then(() => reconfigure())
    .catch((error) => {
      emitError(error);
      throw error;
    });

  const stop: GitWatchStop = async () => {
    if (handleRef.current === null) {
      return;
    }
    const h = handleRef.current;
    handleRef.current = null;
    await h.close();
    if (handlers.onClose) {
      handlers.onClose();
    }
  };

  return stop;
}

/** Emit via onError handler when provided, otherwise throw synchronously. */
export function emitOrThrow(onError: ((err: unknown) => void) | undefined, error: unknown): void {
  if (onError) {
    onError(error);
    return;
  }
  throw error;
}

/** Try/catch helper returning a discriminated union instead of throwing. */
export async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    const v = await fn();
    return { ok: true, value: v };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Resolve a branch hash by first reading the ref file directly, then falling back to rev-parse.
 * Debounces to avoid partial reads while tools write the ref file.
 */
export async function resolveBranchHash(
  repoArg: { revParse: (arg: string) => Promise<string> },
  branch: string,
  filePath: string,
  debounceMs: number,
  timerRef: { t: ReturnType<typeof setTimeout> | null },
): Promise<{ ok: true; hash: string } | { ok: false; error: unknown }> {
  // Debounce to avoid partial write reads
  await new Promise<void>((resolveDebounce) => {
    if (timerRef.t !== null) {
      clearTimeout(timerRef.t);
      timerRef.t = null;
    }
    timerRef.t = setTimeout(() => {
      resolveDebounce();
    }, debounceMs);
  });
  // Try reading the file directly first
  const fileRes = await attempt(async () => {
    const text = await readFile(filePath, 'utf8');
    return text.trim();
  });
  if (fileRes.ok) {
    return { ok: true, hash: fileRes.value };
  }
  // Fallback to `git rev-parse refs/heads/<branch>`
  const revRes = await attempt(async () => repoArg.revParse(`refs/heads/${branch}`));
  if (revRes.ok) {
    return { ok: true, hash: revRes.value };
  }
  return { ok: false, error: revRes.error ?? fileRes.error };
}

/** Update headRefPath in stateRef using HEAD info from repoRoot. */
export async function refreshHeadState(
  stateRef: { headRefPath: string | null },
  repoRoot: string,
  head?: { kind: 'ref' | 'hash'; ref?: string; hash?: string },
): Promise<void> {
  if (!head) {
    const h = await readHeadInfo(repoRoot);
    await refreshHeadState(stateRef, repoRoot, h);
    return;
  }
  if (head.kind === 'ref' && head.ref) {
    // Normalize to absolute path of ref file
    const refPath = join(repoRoot, '.git', head.ref);
    stateRef.headRefPath = refPath;
    return;
  }
  // Detached head; no branch ref to watch specifically
  stateRef.headRefPath = null;
}
