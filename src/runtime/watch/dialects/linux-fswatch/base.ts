/** @file Helpers for Linux fswatch-based strategies. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { WatchHandle, WatchStrategy } from '../../types';
import { statSync } from 'node:fs';
import { dirname } from 'node:path';

type FswatchTune = {
  readonly latency: number; // seconds
};

const ensureFswatchAvailable = (): void => {
  try {
    // Probe by attempting to spawn without args; ENOENT will throw synchronously on .spawn
    const p = spawn('fswatch', ['--version']);
    p.once('error', () => {
      // ignore here; main spawn will surface errors
    });
    p.unref();
  } catch {
    throw new Error('fswatch is required but not found in PATH. Please install fswatch.');
  }
};

const safeIsDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const basePathFor = (p: string): string => {
  if (safeIsDir(p)) {
    return p;
  }
  try {
    return dirname(p);
  } catch {
    return p;
  }
};

const makeCoalescer = (emit: (file: string) => void) => {
  const pending = new Map<string, NodeJS.Timeout>();
  return (file: string): void => {
    const prev = pending.get(file);
    if (prev) {
      clearTimeout(prev);
    }
    const t = setTimeout(() => {
      pending.delete(file);
      emit(file);
    }, 50);
    pending.set(file, t);
  };
};

export const createFswatchStrategy = (tune: FswatchTune): WatchStrategy => {
  return {
    start(paths, onSignal, onReady, onError) {
      ensureFswatchAvailable();

      const bases = Array.from(new Set(paths.map(basePathFor)));

      const childRef: { current: ChildProcessWithoutNullStreams | null } = { current: null };
      const handle: WatchHandle = {
        async close() {
          const current = childRef.current;
          if (current && !current.killed) {
            try {
              current.kill('SIGTERM');
            } catch {
              // ignore
            }
          }
        },
      };

      try {
        const args: string[] = [
          '--recursive',
          `--latency=${tune.latency}`,
          '--event-flags',
          '--format=%p',
          '--batch-marker=__FSWATCH_BATCH_END__',
          '--one-per-batch',
          '--null',
          ...bases,
        ];
        childRef.current = spawn('fswatch', args);

        const readyRef = { done: false };
        const coalesce = makeCoalescer((f) => onSignal('touched', f));
        const bufRef = { s: '' };

        childRef.current.stdout.on('data', (chunk: Buffer) => {
          bufRef.s = bufRef.s + chunk.toString('utf8');
          const parts = bufRef.s.split('\u0000');
          bufRef.s = parts.pop() ?? '';
          for (const part of parts) {
            if (part === '__FSWATCH_BATCH_END__') {
              continue;
            }
            const file = part.trim();
            if (file.length > 0) {
              coalesce(file);
            }
          }
          if (readyRef.done === false) {
            readyRef.done = true;
            onReady();
          }
        });
        childRef.current.stderr.on('data', (chunk: Buffer) => {
          const msg = chunk.toString('utf8');
          if (msg.toLowerCase().includes('error')) {
            onError(new Error(msg));
          }
        });
        childRef.current.on('error', onError);
        childRef.current.on('exit', (code, signal) => {
          if (code !== 0 && signal !== 'SIGTERM') {
            onError(new Error(`fswatch exited with code ${String(code)}`));
          }
        });
      } catch (err) {
        onError(err);
      }

      return handle;
    },
  } as const;
};
