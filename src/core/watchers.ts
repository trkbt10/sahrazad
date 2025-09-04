/**
 * @file Core watch helpers: FS or Git-triggered ingestion.
 */
import type { StartFsWatchArgs } from "./types";
import { FsWatchStrategy } from "../runtime/watch";
import type { GitRepo, GitWatchHandlers, GitWatchOptions } from "../runtime/git";
import { watchGit } from "../runtime/git";

/** Start a debounce-aggregated FS watch and emit changed paths to onChange. */
export function startFsWatch({ paths, debounceMs = 150, onChange }: StartFsWatchArgs) {
  const acc = new Set<string>();
  const timerRef: { t: ReturnType<typeof setTimeout> | null } = { t: null };
  const flush = () => {
    const arr = [...acc];
    acc.clear();
    void onChange(arr);
  };
  const handle = FsWatchStrategy.start(
    paths,
    (_signal, file) => {
      acc.add(file);
      if (timerRef.t !== null) {
        clearTimeout(timerRef.t);
        timerRef.t = null;
      }
      timerRef.t = setTimeout(flush, debounceMs);
    },
    () => { /* ready noop */ },
    (err) => { throw err; },
  );
  return async () => {
    await handle.close();
  };
}

/** Start a Git watch; call onChange with provided targetPaths when index or ref changes. */
export function startGitWatch(
  repo: GitRepo,
  targetPaths: readonly string[],
  options: Partial<GitWatchOptions>,
  onChange: (paths: string[]) => Promise<void>,
) {
  const handlers: GitWatchHandlers = {
    onHead: () => { /* ignore */ },
    onRef: () => { void onChange([...targetPaths]); },
    onIndex: () => { void onChange([...targetPaths]); },
    onError: (err) => { throw err; },
  };
  const stop = watchGit(repo, options, handlers);
  return stop;
}
