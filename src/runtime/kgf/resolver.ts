/**
 * @file Module resolver used by KGF actions. Prefers local files under project root and
 * supports alias rewrites and relative prefixes. Differs from typical bundlers by returning
 * normalized relative paths or a bare-prefixed logical id when resolution fails.
 */
import { existsSync, statSync } from "node:fs";
import { join, dirname, normalize, relative } from "node:path";
import type { ResolverAlias, ResolverSpec } from "./types";

function applyAliases(input: string, aliases: ResolverAlias[]): string {
  return aliases.reduce<string>((acc, a) => {
    try {
      const re = new RegExp(a.pattern, "g");
      return acc.replace(re, a.replace);
    } catch {
      return acc;
    }
  }, input);
}

function moduleToPath(module: string, style: ResolverSpec["module_path_style"]): string {
  if (style === "dot") {
    return module.replaceAll(".", "/");
  }
  if (style === "coloncol") {
    return module.replaceAll("::", "/");
  }
  return module;
}

/**
 * Resolve a module specifier to a project-relative path or a logical id.
 * - Applies resolver aliases.
 * - Handles language-specific namespace prefixes.
 * - Resolves relative prefixes against the importing file or project root.
 */
export function resolveModule(
  res: ResolverSpec,
  language: string,
  fromFile: string,
  module: string,
  projectRoot: string,
): string {
  const module0 = applyAliases(module, res.aliases);

  // Namespaced (composer-like) resolution
  const hasNsPrefix = typeof res.ns_prefix === "string" && res.ns_prefix.length > 0;
  const isNamespaced = module0.includes("\\");
  const isRelativePrefixed = res.relative_prefixes.some((p) => module0.startsWith(p));
  if (hasNsPrefix) {
    if (isNamespaced) {
      if (!isRelativePrefixed) {
        const parts = module0.split("\\");
        const take = Math.min(res.ns_segments, parts.length);
        const key = parts.slice(0, take).join("\\");
        return `${res.ns_prefix}${key}`;
      }
    }
  }

  const tryLocal = (base: string, mod: string): string | null => {
    const modPath = moduleToPath(mod, res.module_path_style);
    const basepath = normalize(join(base, modPath));
    for (const ext of res.exts) {
      const p = basepath + ext;
      if (existsSync(p) && statSync(p).isFile()) {
        return relative(projectRoot, p).replaceAll("\\", "/");
      }
    }
    for (const idx of res.indexes) {
      const p = basepath + idx;
      if (existsSync(p) && statSync(p).isFile()) {
        return relative(projectRoot, p).replaceAll("\\", "/");
      }
    }
    return null;
  };

  // Relative
  const isRelative = res.relative_prefixes.some((p) => {
    if (!p) {
      return false;
    }
    return module0.startsWith(p);
  });
  if (isRelative) {
    if (module0.startsWith("/")) {
      const modClean = module0.slice(1);
      const hit = tryLocal(projectRoot, modClean);
      if (hit) {
        return hit;
      }
    } else {
      const hit = tryLocal(dirname(fromFile), module0);
      if (hit) {
        return hit;
      }
    }
    return `${res.bare_prefix}${module0}`;
  }

  // Non-relative: attempt under root
  const modPath = moduleToPath(module0, res.module_path_style);
  const localTry = join(projectRoot, modPath);
  for (const ext of res.exts) {
    const p = localTry + ext;
    if (existsSync(p) && statSync(p).isFile()) {
      return relative(projectRoot, p).replaceAll("\\", "/");
    }
  }
  for (const idx of res.indexes) {
    const p = localTry + idx;
    if (existsSync(p) && statSync(p).isFile()) {
      return relative(projectRoot, p).replaceAll("\\", "/");
    }
  }
  const head = module0.split(".")[0].split("::")[0].split("/")[0];
  if (res.bare_prefix) {
    return `${res.bare_prefix}${head}`;
  }
  return module0;
}
