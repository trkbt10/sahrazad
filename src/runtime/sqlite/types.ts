/** @file Types for unified SQLite client */
export type SqliteBackend = "bun" | "better-sqlite3" | "auto";

export type SqlParams = unknown[] | Record<string, unknown> | undefined;

export type RunInfo = {
  changes?: number;
  lastInsertRowid?: number | bigint;
};

export type SqliteClient = {
  readonly backend: Exclude<SqliteBackend, "auto">;
  readonly filename: string;
  exec(sql: string): void;
  run(sql: string, params?: SqlParams): RunInfo;
  get<T = Record<string, unknown>>(sql: string, params?: SqlParams): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: SqlParams): T[];
  close(): void;
};

export type BunDatabaseCtor = new (
  filename?: string,
  options?: { readonly?: boolean },
) => {
  exec(sql: string): void;
  prepare(sql: string): {
    run(params?: SqlParams): RunInfo;
    all(params?: SqlParams): unknown[];
    get(params?: SqlParams): unknown | undefined;
  };
  query(sql: string): {
    all(params?: SqlParams): unknown[];
    get(params?: SqlParams): unknown | undefined;
  };
  close(): void;
};

export type BetterSqliteCtor = new (
  filename?: string,
  options?: { readonly?: boolean; fileMustExist?: boolean },
) => {
  exec(sql: string): void;
  prepare(sql: string): {
    run(params?: SqlParams): RunInfo;
    all(params?: SqlParams): unknown[];
    get(params?: SqlParams): unknown | undefined;
  };
  close(): void;
};

export type SqliteClientOptions = {
  backend: SqliteBackend;
  filename: string;
  readOnly?: boolean;
  providers?: {
    bun?: { Database?: BunDatabaseCtor };
    betterSqlite3?: { Database?: BetterSqliteCtor };
  };
};
