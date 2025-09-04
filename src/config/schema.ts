/**
 * @file App config schema and types (config-first; CLI overrides).
 */
import type { JSONSchemaType } from "ajv";

export type AppConfig = {
  provider?: "xenova" | "openai" | "custom";
  model?: string;
  dir?: string[];
  port?: number;
  restful?: boolean;
  mcp?: boolean;
  basePath?: string;
  dim?: number;
  index?: boolean;
  force?: boolean;
  search?: string;
  k?: number;
  excludes?: string[];
  includes?: string[];
  watchFs?: boolean;
  watchGit?: boolean;
  debounceMs?: number;
  kgf?: string | string[];
  verbose?: boolean;
};

export const AppConfigSchema: JSONSchemaType<AppConfig> = {
  type: "object",
  properties: {
    provider: { type: "string", enum: ["xenova", "openai", "custom"], nullable: true, default: "xenova" },
    model: { type: "string", nullable: true },
    dir: { type: "array", items: { type: "string" }, nullable: true, default: [] },
    port: { type: "number", nullable: true, default: 8787 },
    restful: { type: "boolean", nullable: true, default: true },
    mcp: { type: "boolean", nullable: true, default: false },
    basePath: { type: "string", nullable: true, default: "/api" },
    dim: { type: "number", nullable: true },
    index: { type: "boolean", nullable: true, default: false },
    force: { type: "boolean", nullable: true, default: false },
    search: { type: "string", nullable: true, default: "" },
    k: { type: "number", nullable: true, default: 10 },
    excludes: { type: "array", items: { type: "string" }, nullable: true, default: [".git/", "node_modules/", "dist/", "build/", "coverage/", ".kg/", ".vcdb/"] },
    includes: { type: "array", items: { type: "string" }, nullable: true, default: [] },
    watchFs: { type: "boolean", nullable: true, default: false },
    watchGit: { type: "boolean", nullable: true, default: false },
    debounceMs: { type: "number", nullable: true, default: 200 },
    kgf: { anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }], nullable: true },
    verbose: { type: "boolean", nullable: true, default: false },
  },
  required: [],
  additionalProperties: false,
};

