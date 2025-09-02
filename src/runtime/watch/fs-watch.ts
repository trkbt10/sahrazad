/** @file Native fs.watch-based WatchStrategy. Recursive on macOS/Windows; best-effort on Linux. */
import { watch, type FSWatcher, statSync } from 'node:fs';
import { dirname } from 'node:path';
import type { WatchHandle, WatchStrategy } from './types';

function toHandle(watchers: FSWatcher[]): WatchHandle {
  return {
    async close() {
      for (const w of watchers) {
        w.close();
      }
    },
  };
}

const safeIsDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const safeParentIsDir = (p: string): boolean => {
  try {
    return statSync(dirname(p)).isDirectory();
  } catch {
    return false;
  }
};
const computeRecursiveFlag = (isDir: boolean, platform: NodeJS.Platform): boolean => {
  if (platform === 'darwin' || platform === 'win32') {
    if (isDir) {
      return true;
    }
    return false;
  }
  return false;
};

export const FsWatchStrategy: WatchStrategy = {
  start(paths, onSignal, onReady, onError) {
    const watchers: FSWatcher[] = [];
    const readyRef = { n: paths.length };
    const handleReady = (): void => {
      readyRef.n = readyRef.n - 1;
      if (readyRef.n === 0) {
        onReady();
      }
    };
    for (const p of paths) {
      try {
        const isDir = safeIsDir(p) ? true : safeParentIsDir(p);
        const base = isDir ? p : dirname(p);
        const recursiveFlag = computeRecursiveFlag(isDir, process.platform);
        const w = watch(base, { recursive: recursiveFlag }, (_eventType, filename) => {
          const full = isDir && filename ? `${base}/${filename}` : p;
          onSignal('touched', full);
        });
        w.on('error', onError);
        watchers.push(w);
        queueMicrotask(handleReady);
      } catch (err) {
        onError(err);
      }
    }
    return toHandle(watchers);
  },
};

