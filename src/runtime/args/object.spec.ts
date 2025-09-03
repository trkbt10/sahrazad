/**
 * @file Unit tests for parseObjectArgs and FromArgSpec typing.
 */
import { parseObjectArgs } from "./object";

describe("parseObjectArgs", () => {
  it("coerces types and applies defaults (string, number, boolean, string[])", () => {
    const spec = {
      text: { type: "string", default: "" },
      count: { type: "number", default: 3 },
      flag: { type: "boolean", default: true },
      files: { type: "string[]", default: ["a.ts"] },
    } as const;

    const parsed = parseObjectArgs({ text: "hi", count: "5", flag: "false" }, spec);
    expect(parsed.text).toBe("hi");
    expect(parsed.count).toBe(5);
    expect(parsed.flag).toBe(false);
    expect(Array.isArray(parsed.files)).toBe(true);
    expect(parsed.files.length >= 1).toBe(true);

    // Typing check (compile-time): files must be string[] (required due to default)
    const files: string[] = parsed.files;
    expect(files[0]).toBeTypeOf("string");
  });

  it("leaves unspecified optional fields undefined when no default provided", () => {
    const spec = {
      maybe: { type: "number" },
      names: { type: "string[]" },
    } as const;
    const parsed = parseObjectArgs({}, spec);
    expect(Object.prototype.hasOwnProperty.call(parsed, "maybe")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(parsed, "names")).toBe(false);
  });
});

