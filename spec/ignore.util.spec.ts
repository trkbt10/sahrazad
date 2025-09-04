/**
 * @file Tests for ignore matcher utility.
 */
import { shouldIgnore } from "../src/core/domain/ignore";

describe("shouldIgnore", () => {
  it("matches prefixes and nested paths", () => {
    const pats = [".git/", "node_modules/"];
    expect(shouldIgnore(".git/index", pats)).toBe(true);
    expect(shouldIgnore("src/.git/index", pats)).toBe(true);
    expect(shouldIgnore("node_modules/pkg/file.js", pats)).toBe(true);
    expect(shouldIgnore("src/app.ts", pats)).toBe(false);
  });
});

