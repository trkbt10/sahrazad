/**
 * @file Ensures KGF v5 fixtures are present under __fixtures__ for tests.
 */
import { readdirSync, statSync } from "node:fs";

describe("kgf fixtures", () => {
  it("copies specs and examples under fixtures", () => {
    const base = "src/runtime/kgf/__fixtures__";
    const specs = `${base}/specs`;
    const examples = `${base}/examples`;
    expect(statSync(specs).isDirectory()).toBe(true);
    expect(statSync(examples).isDirectory()).toBe(true);
    const specFiles = readdirSync(specs);
    expect(specFiles.length).toBeGreaterThan(0);
  });
});
