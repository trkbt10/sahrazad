/* eslint-disable -- Type shims for external 'better-sqlite3' */
declare module 'better-sqlite3' {
  export type Options = {
    readonly?: boolean;
    fileMustExist?: boolean;
  };

  export type RunResult = {
    changes?: number;
    lastInsertRowid?: number | bigint;
  };

  export type Statement = {
    run(params?: unknown[] | Record<string, unknown>): RunResult;
    all<T = unknown>(params?: unknown[] | Record<string, unknown>): T[];
    get<T = unknown>(params?: unknown[] | Record<string, unknown>): T | undefined;
  };

  export default class Database {
    constructor(filename?: string, options?: Options);
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
  }
}
