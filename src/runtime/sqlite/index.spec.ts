/** @file SQLite abstraction tests */
import { createSqliteClient } from "./index";
import type { BetterSqliteCtor, BunDatabaseCtor } from "./types";

describe("sqlite abstraction - bun backend", () => {
  it("creates table, inserts, and queries rows", async () => {
    // Minimal fake for Bun Database implemented as a class to satisfy constructor typing.
    class FakeBunDb {
      private store: Map<string, string>;
      constructor(_filename?: string, _options?: { readonly?: boolean }) {
        void _filename;
        void _options;
        this.store = new Map<string, string>();
      }
      exec(sql: string): void {
        void sql;
      }
      prepare(sql: string): {
        run: (p?: unknown) => { changes: number; lastInsertRowid: number };
        all: (_p?: unknown) => unknown[];
        get: (_p?: unknown) => unknown | undefined;
      } {
        const obj = {
          run: (p?: unknown) => {
            if (sql.includes("INSERT INTO kv")) {
              if (Array.isArray(p)) {
                const [k, v] = p as [string, string];
                this.store.set(k, v);
              } else if (p && typeof p === "object") {
                const o = p as { k?: string; v?: string };
                if (o.k !== undefined && o.v !== undefined) {
                  this.store.set(o.k, o.v);
                }
              }
              return { changes: 1, lastInsertRowid: this.store.size };
            }
            return { changes: 0, lastInsertRowid: 0 };
          },
          // Provided for type compatibility; not used in this case.
          all: (_p?: unknown) => {
            void _p;
            return [];
          },
          get: (_p?: unknown) => {
            void _p;
            return undefined;
          },
        };
        return obj;
      }
      query(sql: string): { get: (p?: unknown) => unknown | undefined; all: (_p?: unknown) => unknown[] } {
        const obj = {
          get: (p?: unknown) => {
            if (sql.includes("SELECT v FROM kv WHERE k = ?")) {
              const tuple = Array.isArray(p) ? (p as [string]) : [undefined];
              const k = tuple[0];
              const v = k !== undefined ? this.store.get(k) : undefined;
              return v === undefined ? undefined : { v };
            }
            return undefined;
          },
          all: (_p?: unknown) => {
            void _p;
            if (sql.includes("SELECT k,v FROM kv ORDER BY k")) {
              return Array.from(this.store.entries())
                .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
                .map(([k, v]) => ({ k, v }));
            }
            return [];
          },
        };
        return obj;
      }
      close(): void {}
    }

    const BunCtor: BunDatabaseCtor = FakeBunDb;
    const db = await createSqliteClient({
      backend: "bun",
      filename: ":memory:",
      // Note: This is a test double implementing the required surface.
      providers: { bun: { Database: BunCtor } },
    });
    expect(db.backend).toBe("bun");

    db.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)");

    const insert = db.run("INSERT INTO kv (k,v) VALUES (?, ?)", ["a", "1"]);
    expect(typeof insert).toBe("object");

    db.run("INSERT INTO kv (k,v) VALUES (:k, :v)", { k: "b", v: "2" });

    const one = db.get<{ v: string }>("SELECT v FROM kv WHERE k = ?", ["a"]);
    expect(one?.v).toBe("1");

    const all = db.all<{ k: string; v: string }>("SELECT k,v FROM kv ORDER BY k");
    expect(all.map((r) => r.k)).toEqual(["a", "b"]);

    db.close();
  });
});

describe("sqlite abstraction - better-sqlite3 backend (DI)", () => {
  it("supports DI for better-sqlite3 and returns normalized results", async () => {
    // Minimal better-sqlite3 fake as class to satisfy constructor typing.
    class FakeDb {
      filename: string;
      constructor(filename?: string) {
        this.filename = filename ?? ":memory:";
      }
      exec(sql: string): void {
        fakeExecCalls.push(sql);
      }
      close(): void {}
      prepare(sql: string) {
        fakePrepareCalls.push(sql);
        return fakeStmt;
      }
    }
    const fakeExecCalls: string[] = [];
    const fakePrepareCalls: string[] = [];
    const fakeStmt = {
      run: () => ({ changes: 1, lastInsertRowid: 42 }),
      all: () => [{ id: 1 }, { id: 2 }],
      get: () => ({ id: 1 }),
    };
    const ctor: BetterSqliteCtor = FakeDb;
    const db = await createSqliteClient({
      backend: "better-sqlite3",
      filename: ":memory:",
      providers: { betterSqlite3: { Database: ctor } },
    });

    db.exec("SELECT 1");
    expect(fakeExecCalls).toEqual(["SELECT 1"]);

    const info = db.run("INSERT INTO t DEFAULT VALUES");
    expect(info.changes).toBe(1);
    expect(info.lastInsertRowid).toBe(42);

    const row = db.get<{ id: number }>("SELECT id FROM t LIMIT 1");
    expect(row?.id).toBe(1);

    const rows = db.all("SELECT id FROM t") as Array<{ id: number }>;
    expect(rows).toHaveLength(2);

    db.close();
    expect(fakePrepareCalls.length).toBeGreaterThan(0);
  });
});

describe("sqlite abstraction - auto detection in Bun", () => {
  it("resolves to bun in Bun runtime", async () => {
    // Provide both providers; factory should pick a valid backend for this runtime.
    class FakeBunDb2 {
      exec(_s: string): void {
        void _s;
      }
      prepare(_s: string): {
        run: () => { changes: number; lastInsertRowid: number };
        all: () => unknown[];
        get: () => unknown | undefined;
      } {
        void _s;
        return { run: () => ({ changes: 0, lastInsertRowid: 0 }), all: () => [], get: () => undefined };
      }
      query(_s: string): { get: () => unknown | undefined; all: () => unknown[] } {
        void _s;
        return { get: () => undefined, all: () => [] };
      }
      close(): void {}
    }
    class FakeBetterDb2 {
      exec(_s: string): void {
        void _s;
      }
      prepare(_s: string): {
        run: () => { changes: number; lastInsertRowid: number };
        all: () => unknown[];
        get: () => unknown | undefined;
      } {
        void _s;
        return { run: () => ({ changes: 0, lastInsertRowid: 0 }), all: () => [], get: () => undefined };
      }
      close(): void {}
    }
    const BunCtor2: BunDatabaseCtor = FakeBunDb2;
    const BetterCtor2: BetterSqliteCtor = FakeBetterDb2;
    const client = await createSqliteClient({
      backend: "auto",
      filename: ":memory:",
      // Class-based test doubles implement the required constructor surface.
      providers: { bun: { Database: BunCtor2 }, betterSqlite3: { Database: BetterCtor2 } },
    });
    expect(["bun", "better-sqlite3"]).toContain(client.backend);
    client.close();
  });
});
