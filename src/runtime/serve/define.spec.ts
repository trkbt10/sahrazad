/**
 * @file Tests for defineAction/defineActions helpers.
 */
import { defineAction, defineActions, defineJsonAction } from "./define";
import type { JSONSchemaType } from "ajv";

describe("defineAction", () => {
  it("parses args by spec and calls impl with defaults applied", async () => {
    const fn = defineAction(
      { a: { type: "string", default: "x" }, n: { type: "number", default: 1 }, b: { type: "boolean", default: true } },
      async (p) => ({ a: p.a, n: p.n, b: p.b }),
    );
    const res = await fn({});
    expect(res).toEqual({ a: "x", n: 1, b: true });
  });
});

describe("defineActions", () => {
  it("builds a registry of wrapped actions", async () => {
    const reg = defineActions({
      ping: { spec: { m: { type: "string", default: "ok" } }, impl: async (p) => ({ msg: p.m }) },
    });
    const out = await reg.ping({});
    expect(out).toEqual({ msg: "ok" });
  });
});

describe("defineJsonAction", () => {
  it("coerces and applies defaults via Ajv", async () => {
    type P = { n: number; flag?: boolean };
    const schema: JSONSchemaType<P> = {
      type: "object",
      properties: {
        n: { type: "number", default: 1 },
        flag: { type: "boolean", nullable: true, default: true },
      },
      required: [],
      additionalProperties: false,
    };
    const fn = defineJsonAction<P>(schema, async (p) => ({ n: p.n, flag: p.flag }));
    const res = await fn({ n: "1" });
    expect(res).toEqual({ n: 1, flag: true });
  });

  it("builds a single json action", async () => {
    type Q = { s: string };
    const schema: JSONSchemaType<Q> = { type: "object", properties: { s: { type: "string", default: "x" } }, required: [], additionalProperties: false };
    const fn = defineJsonAction<Q>(schema, async (p) => ({ s: p.s }));
    const out = await fn({});
    expect(out).toEqual({ s: "x" });
  });
});
