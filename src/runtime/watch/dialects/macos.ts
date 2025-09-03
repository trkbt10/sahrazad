/** @file macOS-native fs.watch strategy (recursive directories). */
import { watch, type FSWatcher, statSync } from 'node:fs';
import { dirname } from 'node:path';
import type { WatchHandle, WatchStrategy } from '../types';

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
// Parent existence is not required for base selection; watch() will throw and be reported via onError.

export const MacOSWatchStrategy: WatchStrategy = {
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
        const pIsDir = safeIsDir(p);
        const base = pIsDir ? p : dirname(p);
        const w = watch(base, { recursive: pIsDir }, (_eventType, filename) => {
          const full = pIsDir && filename ? `${base}/${filename}` : p;
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
