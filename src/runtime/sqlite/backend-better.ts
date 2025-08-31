/* eslint-disable jsdoc/require-file-overview -- thin wrapper for better-sqlite3 binding */
import type { SqlParams, RunInfo, SqliteClient, BetterSqliteCtor } from "./types";
import BetterSqlite3 from "better-sqlite3";

/**
 * Create a SqliteClient backed by `better-sqlite3`.
 * @param filename Database file (use ':memory:' for in-memory)
 * @param readOnly Open database in read-only mode when true
 */
export function createBetterSqlite(
  filename: string,
  readOnly: boolean | undefined,
): SqliteClient {
  if (filename === undefined || filename === null) {
    throw new Error("filename is required");
  }

  const db = new BetterSqlite3(filename, {
    readonly: readOnly === true,
    fileMustExist: false,
  });

  const exec = (sql: string): void => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    db.exec(sql);
  };

  const run = (sql: string, params?: SqlParams): RunInfo => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    const info = db.prepare(sql).run(bind);
    return { changes: info?.changes, lastInsertRowid: info?.lastInsertRowid };
  };

  const get = <T,>(sql: string, params?: SqlParams): T | undefined => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    return db.prepare(sql).get(bind) as T | undefined;
  };

  const all = <T,>(sql: string, params?: SqlParams): T[] => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    return db.prepare(sql).all(bind) as T[];
  };

  const close = (): void => {
    db.close();
  };

  return {
    backend: "better-sqlite3",
    filename,
    exec,
    run,
    get,
    all,
    close,
  };
}

/**
 * Create a better-sqlite3-backed client using an injected constructor (for tests/DI).
 * @param Ctor Injected Database constructor
 * @param filename Database file
 * @param readOnly Read-only flag
 */
export function createBetterSqliteWithCtor(
  Ctor: BetterSqliteCtor,
  filename: string,
  readOnly: boolean | undefined,
): SqliteClient {
  // Same behavior as createBetterSqlite but using an injected constructor for testability.
  const db = new Ctor(filename, { readonly: readOnly === true, fileMustExist: false });
  const exec = (sql: string): void => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    db.exec(sql);
  };
  const run = (sql: string, params?: SqlParams): RunInfo => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    const info = db.prepare(sql).run(bind);
    return { changes: info?.changes, lastInsertRowid: info?.lastInsertRowid };
  };
  const get = <T,>(sql: string, params?: SqlParams): T | undefined => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    return db.prepare(sql).get(bind) as T | undefined;
  };
  const all = <T,>(sql: string, params?: SqlParams): T[] => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    return db.prepare(sql).all(bind) as T[];
  };
  const close = (): void => {
    db.close();
  };
  return {
    backend: "better-sqlite3",
    filename,
    exec,
    run,
    get,
    all,
    close,
  };
}
