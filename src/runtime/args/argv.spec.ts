/**
 * @file Unit tests for parseArgv and FromArgSpec typing.
 */
import { parseArgv } from "./argv";

describe("parseArgv", () => {
  it("parses flags and coerces per spec", () => {
    const spec = {
      text: { type: "string", default: "" },
      topK: { type: "number", default: 10 },
      expand: { type: "boolean", default: true },
      files: { type: "string[]", default: [] },
    } as const;
    const argv = ["--text", "hello", "--topK", "7", "--expand", "false", "--files", "a.ts", "--files", "b.ts"]; // boolean takes value here for stability across shells
    const parsed = parseArgv(argv, spec);
    expect(parsed.text).toBe("hello");
    expect(parsed.topK).toBe(7);
    expect(parsed.expand).toBe(false);
    expect(parsed.files.length).toBe(2);
  });
});

