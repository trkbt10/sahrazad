/** @file Generic file watch strategy types (OS-agnostic) */

export type FsSignal = 'touched';

export type WatchHandle = { close(): Promise<void> };

export type WatchStrategy = {
  start(
    paths: readonly string[],
    onSignal: (signal: FsSignal, filePath: string) => void,
    onReady: () => void,
    onError: (err: unknown) => void,
  ): WatchHandle;
};

