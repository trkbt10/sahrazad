/* eslint-disable jsdoc/require-file-overview -- thin wrapper for Bun's sqlite binding */
import type { SqlParams, RunInfo, SqliteClient, BunDatabaseCtor } from "./types";
import { Database } from "bun:sqlite";

/**
 * Create a SqliteClient backed by Bun's built-in `bun:sqlite`.
 * @param filename Database file (use ':memory:' for in-memory)
 * @param readOnly Open database in read-only mode when true
 */
export function createBunSqlite(filename: string, readOnly: boolean | undefined): SqliteClient {
  if (filename === undefined || filename === null) {
    throw new Error("filename is required");
  }

  const db = new Database(filename, { readonly: readOnly === true });

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
    const stmt = db.prepare(sql);
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    const info = stmt.run(bind);
    return { changes: info?.changes, lastInsertRowid: info?.lastInsertRowid };
  };

  const get = <T,>(sql: string, params?: SqlParams): T | undefined => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    // Prefer query(...).get(...) to avoid preparing twice; both are ok in Bun.
    // Note: Bun's `Database.query` generic availability varies across type defs.
    // We intentionally avoid generic arguments here and cast the result to T,
    // because this wrapper's job is to normalize shapes across drivers.
    const q = db.query(sql);
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    return q.get(bind) as T | undefined;
  };

  const all = <T,>(sql: string, params?: SqlParams): T[] => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    // See note above: avoid generics on `query` to absorb driver typedef differences.
    const q = db.query(sql);
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    return q.all(bind) as T[];
  };

  const close = (): void => {
    db.close();
  };

  return {
    backend: "bun",
    filename,
    exec,
    run,
    get,
    all,
    close,
  };
}

/**
 * Create a Bun-backed client using an injected constructor (for tests/DI).
 * @param Ctor Injected Database constructor
 * @param filename Database file
 * @param readOnly Read-only flag
 */
export function createBunSqliteWithCtor(
  Ctor: BunDatabaseCtor,
  filename: string,
  readOnly: boolean | undefined,
): SqliteClient {
  // Same behavior as createBunSqlite but using an injected constructor for testability.
  const db = new Ctor(filename, { readonly: readOnly === true });
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
    // Avoid generics on `query`; cast the result to T to normalize across drivers.
    return db.query(sql).get(bind) as T | undefined;
  };
  const all = <T,>(sql: string, params?: SqlParams): T[] => {
    if (sql === undefined || sql === null || sql === "") {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    // Avoid generics on `query`; cast result array to T[] (typing shim layer).
    return db.query(sql).all(bind) as T[];
  };
  const close = (): void => {
    db.close();
  };
  return { backend: "bun", filename, exec, run, get, all, close };
}
