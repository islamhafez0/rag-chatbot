import { describe, it, expect, afterEach } from "vitest";
import {
  envOptionalNumber,
  envOptionalBoolean,
  assertValidIdentifier,
} from "../env";

const KEYS = ["TEST_NUM", "TEST_BOOL"];

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("envOptionalNumber", () => {
  it("returns the fallback when unset or blank", () => {
    expect(envOptionalNumber("TEST_NUM", 7)).toBe(7);
    process.env.TEST_NUM = "  ";
    expect(envOptionalNumber("TEST_NUM", 7)).toBe(7);
  });

  it("parses set values", () => {
    process.env.TEST_NUM = "42";
    expect(envOptionalNumber("TEST_NUM", 7)).toBe(42);
  });

  it("throws on non-numeric values", () => {
    process.env.TEST_NUM = "many";
    expect(() => envOptionalNumber("TEST_NUM", 7)).toThrow();
  });
});

describe("envOptionalBoolean", () => {
  it("returns the fallback when unset", () => {
    expect(envOptionalBoolean("TEST_BOOL", true)).toBe(true);
    expect(envOptionalBoolean("TEST_BOOL", false)).toBe(false);
  });

  it("parses true/false variants", () => {
    for (const v of ["true", "1", "yes", " TRUE "]) {
      process.env.TEST_BOOL = v;
      expect(envOptionalBoolean("TEST_BOOL", false)).toBe(true);
    }
    for (const v of ["false", "0", "no", " FALSE "]) {
      process.env.TEST_BOOL = v;
      expect(envOptionalBoolean("TEST_BOOL", true)).toBe(false);
    }
  });

  it("throws on other values", () => {
    process.env.TEST_BOOL = "perhaps";
    expect(() => envOptionalBoolean("TEST_BOOL", false)).toThrow();
  });
});

describe("assertValidIdentifier", () => {
  it("accepts plain table names", () => {
    expect(() => assertValidIdentifier("table", "me_vectors")).not.toThrow();
    expect(() => assertValidIdentifier("table", "_v2")).not.toThrow();
  });

  it("rejects hostile or qualified names", () => {
    expect(() => assertValidIdentifier("table", "x; DROP TABLE y")).toThrow();
    expect(() => assertValidIdentifier("table", "public.t")).toThrow();
    expect(() => assertValidIdentifier("table", "9lives")).toThrow();
    expect(() => assertValidIdentifier("table", "")).toThrow();
  });
});
