/**
 * @file Extended unit tests for the KGF module resolver.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveModule } from "./resolver";
import type { ResolverAlias, ResolverSpec } from "./types";

function rootDir(): string {
  return mkdtempSync(join(tmpdir(), "kgf-resolve-"));
}

function baseSpec(partial?: Partial<ResolverSpec>): ResolverSpec {
  return {
    sources: [".ts", ".tsx"],
    relative_prefixes: ["./", "../", "/"],
    exts: [".ts", ".tsx"],
    indexes: ["/index.ts", "/index.tsx"],
    bare_prefix: "npm:",
    module_path_style: "slash",
    aliases: [],
    ns_segments: 2,
    rust_mod_mode: false,
    cargo_auto_from_roots: [],
    ...partial,
  };
}

describe("resolver extended", () => {
  it("resolves ../ relative path", () => {
    const root = rootDir();
    mkdirSync(join(root, "pkg"), { recursive: true });
    writeFileSync(join(root, "pkg", "a.ts"), "", "utf8");
    const spec = baseSpec();
    const out = resolveModule(spec, "ts", "pkg/main.ts", "../pkg/a", root);
    expect(out).toBe("pkg/a.ts");
  });

  it("resolves / absolute-like relative path from project root", () => {
    const root = rootDir();
    mkdirSync(join(root, "lib"), { recursive: true });
    writeFileSync(join(root, "lib", "x.ts"), "", "utf8");
    const spec = baseSpec();
    const out = resolveModule(spec, "ts", "src/any.ts", "/lib/x", root);
    expect(out).toBe("lib/x.ts");
  });

  it("resolves non-relative under root with exts and index", () => {
    const root = rootDir();
    mkdirSync(join(root, "util"), { recursive: true });
    writeFileSync(join(root, "util", "index.ts"), "", "utf8");
    const spec = baseSpec();
    const out = resolveModule(spec, "ts", "src/any.ts", "util", root);
    expect(out).toBe("util/index.ts");
  });

  it("applies aliases before resolution", () => {
    const root = rootDir();
    mkdirSync(join(root, "src", "core"), { recursive: true });
    writeFileSync(join(root, "src", "core", "util.ts"), "", "utf8");
    const aliases: ResolverAlias[] = [{ pattern: "^@/", replace: "src/" }];
    const spec = baseSpec({ aliases });
    const out = resolveModule(spec, "ts", "src/index.ts", "@/core/util", root);
    expect(out).toBe("src/core/util.ts");
  });

  it("resolves with dot path style", () => {
    const root = rootDir();
    mkdirSync(join(root, "a", "b"), { recursive: true });
    writeFileSync(join(root, "a", "b", "c.ts"), "", "utf8");
    const spec = baseSpec({ module_path_style: "dot" });
    const out = resolveModule(spec, "ts", "main.ts", "a.b.c", root);
    expect(out).toBe("a/b/c.ts");
  });

  it("resolves with coloncol path style", () => {
    const root = rootDir();
    mkdirSync(join(root, "ns", "mod"), { recursive: true });
    writeFileSync(join(root, "ns", "mod", "file.ts"), "", "utf8");
    const spec = baseSpec({ module_path_style: "coloncol" });
    const out = resolveModule(spec, "ts", "main.ts", "ns::mod::file", root);
    expect(out).toBe("ns/mod/file.ts");
  });

  it("returns bare_prefix when unresolved non-relative", () => {
    const root = rootDir();
    const spec = baseSpec({ bare_prefix: "npm:" });
    const out = resolveModule(spec, "ts", "main.ts", "react", root);
    expect(out).toBe("npm:react");
  });

  it("handles ns_prefix mapping with backslashes", () => {
    const root = rootDir();
    const spec = baseSpec({ ns_prefix: "vendor/", ns_segments: 2 });
    const out = resolveModule(spec, "php", "index.php", "Foo\\Bar\\Baz", root);
    expect(out).toBe("vendor/Foo\\Bar");
  });

  it("prefers exts order and picks .tsx when .ts missing", () => {
    const root = rootDir();
    mkdirSync(join(root, "ui"), { recursive: true });
    writeFileSync(join(root, "ui", "widget.tsx"), "", "utf8");
    const spec = baseSpec({ exts: [".ts", ".tsx"] });
    const out = resolveModule(spec, "ts", "main.ts", "ui/widget", root);
    expect(out).toBe("ui/widget.tsx");
  });
});

