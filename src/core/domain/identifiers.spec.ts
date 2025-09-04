/**
 * @file Unit tests for core/domain/ids helpers.
 */

// Vitest globals are provided by the runner; do not import.
import { toFileId, isFileId, filePathFromId, toSymbolId, isSymbolId } from "./identifiers";

describe("core/domain/ids", () => {
  it("builds and parses file IDs", () => {
    const id = toFileId("src\\app.ts");
    expect(id).toBe("file://src/app.ts");
    expect(isFileId(id)).toBe(true);
    expect(filePathFromId(id)).toBe("src/app.ts");
  });

  it("handles non-file IDs gracefully", () => {
    expect(isFileId("symbol://x")).toBe(false);
    expect(filePathFromId("symbol://x")).toBeUndefined();
  });

  it("builds and detects symbol IDs", () => {
    const sid = toSymbolId("module:fn");
    expect(sid).toBe("symbol://module:fn");
    expect(isSymbolId(sid)).toBe(true);
  });
});
