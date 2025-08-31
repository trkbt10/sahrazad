/* eslint-disable jsdoc/require-file-overview -- factory to create a unified SQLite client */
import type { SqliteClient, SqliteClientOptions, SqliteBackend } from "./types";

/**
 * Create a unified SqliteClient, selecting the backend by options or runtime.
 * @param options Options including backend selection, filename, and optional providers for DI
 */
export async function createSqliteClient(options: SqliteClientOptions): Promise<SqliteClient> {
  const { backend, filename, readOnly } = options;
  if (backend === undefined || backend === null) {
    throw new Error("backend is required (bun|better-sqlite3|auto)");
  }
  if (filename === undefined || filename === null) {
    throw new Error("filename is required");
  }

  const resolved: Exclude<SqliteBackend, "auto"> = backend === "auto" ? detectBackend() : backend;

  if (resolved === "bun") {
    if (options.providers?.bun?.Database !== undefined) {
      return createFromBunCtor(options.providers.bun.Database, filename, readOnly);
    }
    // The dynamic import is required to avoid Node resolving 'bun:sqlite' in non-Bun runtimes.
    // eslint-disable-next-line no-restricted-syntax -- dynamic import is deliberate here for conditional backend loading
    const mod = await import("./backend-bun.js");
    return mod.createBunSqlite(filename, readOnly);
  }
  if (resolved === "better-sqlite3") {
    if (options.providers?.betterSqlite3?.Database !== undefined) {
      return createFromBetterCtor(options.providers.betterSqlite3.Database, filename, readOnly);
    }
    // eslint-disable-next-line no-restricted-syntax -- dynamic import is deliberate here for conditional backend loading
    const mod = await import("./backend-better.js");
    return mod.createBetterSqlite(filename, readOnly);
  }
  throw new Error(`Unsupported backend: ${String(resolved)}`);
}

function detectBackend(): Exclude<SqliteBackend, "auto"> {
  // Prefer Bun when available.
  const g = globalThis as { Bun?: unknown };
  if (typeof g.Bun !== "undefined") {
    return "bun";
  }
  return "better-sqlite3";
}

export type { SqliteClient, SqliteClientOptions } from "./types";

// Local helpers to support DI without importing backend modules (for test environments).
import type { BunDatabaseCtor, BetterSqliteCtor, SqlParams, RunInfo } from "./types";

function createFromBunCtor(Ctor: BunDatabaseCtor, filename: string, readOnly?: boolean) {
  const db = new Ctor(filename, { readonly: readOnly === true });
  const exec = (sql: string): void => {
    if (!sql) {
      throw new Error("sql is required");
    }
    db.exec(sql);
  };
  const run = (sql: string, params?: SqlParams): RunInfo => {
    if (!sql) {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    const info = db.prepare(sql).run(bind);
    return { changes: info?.changes, lastInsertRowid: info?.lastInsertRowid };
  };
  const get = <T,>(sql: string, params?: SqlParams): T | undefined => {
    if (!sql) {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    return db.query(sql).get(bind) as T | undefined;
  };
  const all = <T,>(sql: string, params?: SqlParams): T[] => {
    if (!sql) {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    return db.query(sql).all(bind) as T[];
  };
  const close = (): void => {
    db.close();
  };
  return { backend: "bun" as const, filename, exec, run, get, all, close };
}

function createFromBetterCtor(
  Ctor: BetterSqliteCtor,
  filename: string,
  readOnly?: boolean,
) {
  const db = new Ctor(filename, { readonly: readOnly === true, fileMustExist: false });
  const exec = (sql: string): void => {
    if (!sql) {
      throw new Error("sql is required");
    }
    db.exec(sql);
  };
  const run = (sql: string, params?: SqlParams): RunInfo => {
    if (!sql) {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    const info = db.prepare(sql).run(bind);
    return { changes: info?.changes, lastInsertRowid: info?.lastInsertRowid };
  };
  const get = <T,>(sql: string, params?: SqlParams): T | undefined => {
    if (!sql) {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    return db.prepare(sql).get(bind) as T | undefined;
  };
  const all = <T,>(sql: string, params?: SqlParams): T[] => {
    if (!sql) {
      throw new Error("sql is required");
    }
    const bind: unknown[] | Record<string, unknown> | undefined = params;
    return db.prepare(sql).all(bind) as T[];
  };
  const close = (): void => {
    db.close();
  };
  return { backend: "better-sqlite3" as const, filename, exec, run, get, all, close };
}
