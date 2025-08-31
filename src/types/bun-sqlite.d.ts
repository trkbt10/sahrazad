/* eslint-disable -- Type shims for external 'bun:sqlite' */
declare module 'bun:sqlite' {
  export class Database {
    constructor(filename?: string, options?: { readonly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): Statement;
    query<T = unknown>(sql: string): Query<T>;
    close(): void;
  }

  export type StatementRunResult = {
    changes?: number;
    lastInsertRowid?: number | bigint;
  };

  export type Statement = {
    run(params?: unknown[] | Record<string, unknown>): StatementRunResult;
    all<T = unknown>(params?: unknown[] | Record<string, unknown>): T[];
    get<T = unknown>(params?: unknown[] | Record<string, unknown>): T | undefined;
  };

  export type Query<T = unknown> = {
    all(params?: unknown[] | Record<string, unknown>): T[];
    get(params?: unknown[] | Record<string, unknown>): T | undefined;
  };
}
