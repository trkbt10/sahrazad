/**
 * @file Resolver behavior tests.
 */
import { resolveModule } from "./resolver";
import type { ResolverSpec } from "./types";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function mkRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "kgf-resolve-"));
  return dir;
}

describe("resolver", () => {
  it("resolves relative with exts and index", () => {
    const root = mkRoot();
    const spec: ResolverSpec = {
      sources: [".ts"],
      relative_prefixes: ["./", "../", "/"],
      exts: [".ts"],
      indexes: ["/index.ts"],
      bare_prefix: "npm:",
      module_path_style: "slash",
      aliases: [],
      ns_segments: 2,
      rust_mod_mode: false,
      cargo_auto_from_roots: [],
    };
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "util.ts"), "", { encoding: "utf8", flag: "w" });
    const from = "src/main.ts";
    const a = resolveModule(spec, "ts", from, "./util", root);
    expect(a.endsWith("src/util.ts")).toBe(true);
  });
});
