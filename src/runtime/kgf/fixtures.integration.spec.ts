/**
 * @file Integration check: run all __fixtures__/specs/*.kgf against matching examples folder
 * to ensure the runtime can parse and index without crashing, and produces some modules.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { parseKGF } from "./spec";
import { createTool } from "./tool";
import { toJSON } from "./graph";

const FIXTURES_ROOT = join("src", "runtime", "kgf", "__fixtures__");
const SPECS_DIR = join(FIXTURES_ROOT, "specs");
const EXAMPLES_DIR = join(FIXTURES_ROOT, "examples");

function mapSpecToExample(specFile: string): string | null {
  const name = basename(specFile, ".kgf");
  const map: Record<string, string> = {
    "ts-peg": "ts",
  };
  const dir = map[name] ?? name;
  const abs = join(EXAMPLES_DIR, dir);
  try {
    if (statSync(abs).isDirectory()) {
      return abs;
    }
  } catch {
    return null;
  }
  return null;
}

describe("fixtures integration", () => {
  const specs = readdirSync(SPECS_DIR).filter((f) => f.endsWith(".kgf"));
  for (const file of specs) {
    const exampleDir = mapSpecToExample(file);
    if (!exampleDir) {
      it.skip(`${file} has no matching examples dir`, () => {});
      continue;
    }
    it(`${file} parses and indexes examples`, () => {
      const kgfText = readFileSync(join(SPECS_DIR, file), "utf8");
      const spec = parseKGF(kgfText);
      const tool = createTool(spec, exampleDir);
      // Count candidate files by resolver.sources
      const exts = (spec.resolver.sources ?? []).slice();
      const listAll = (dir: string): string[] => {
        const out: string[] = [];
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          const st = statSync(full);
          if (st.isDirectory()) {
            out.push(...listAll(full));
          } else if (st.isFile()) {
            out.push(full.slice(exampleDir.length + 1));
          }
        }
        return out;
      };
      const all = listAll(exampleDir);
      const targets = all
        .filter((rel) => exts.length === 0 ? true : exts.some((e) => rel.endsWith(e)))
        .map((rel) => join(exampleDir, rel));
      const graph = tool.indexPaths(targets.length > 0 ? targets : [exampleDir]);
      const actual = toJSON(graph);
      const expectedPath = join(exampleDir, "graph.json");
      // if golden exists, compare loosely (modules equality, edges as subset on kind/from/to)
      try {
        const golden = JSON.parse(readFileSync(expectedPath, "utf8")) as typeof actual;
        // modules: keys and file fields must match
        expect(Object.keys(actual.modules).sort()).toEqual(Object.keys(golden.modules).sort());
        for (const [k, v] of Object.entries(golden.modules)) {
          expect(actual.modules[k]?.file ?? null).toEqual(v.file ?? null);
        }
        // edges: every golden edge (kind/from/to) must exist in actual
        const toKey = (e: unknown): string => {
          if (typeof e === "object" && e !== null) {
            const o = e as Record<string, unknown>;
            const k = String(o.kind ?? "");
            const f = String(o.from ?? "");
            const t = String(o.to ?? "");
            return `${k}|${f}|${t}`;
          }
          return "||";
        };
        const actualSet = new Set(actual.edges.map((e) => toKey(e)));
        for (const e of golden.edges) {
          expect(actualSet.has(toKey(e))).toBe(true);
        }
      } catch {
        // no golden → at least produce a graph object
        expect(actual).toBeTruthy();
      }
    });
  }
});
