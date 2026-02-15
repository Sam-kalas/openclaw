import { describe, expect, it } from "vitest";
import { emptyPluginConfigSchema } from "./config-schema.js";

describe("emptyPluginConfigSchema", () => {
  const schema = emptyPluginConfigSchema();

  it("accepts undefined value", () => {
    const result = schema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects null", () => {
    const result = schema.safeParse(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("expected config object");
    }
  });

  it("rejects string", () => {
    const result = schema.safeParse("hello");
    expect(result.success).toBe(false);
  });

  it("rejects array", () => {
    const result = schema.safeParse([1, 2, 3]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("expected config object");
    }
  });

  it("rejects non-empty object", () => {
    const result = schema.safeParse({ key: "value" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("config must be empty");
    }
  });

  it("has a valid JSON schema descriptor", () => {
    expect(schema.jsonSchema).toEqual({
      type: "object",
      additionalProperties: false,
      properties: {},
    });
  });

  it("rejects number", () => {
    const result = schema.safeParse(42);
    expect(result.success).toBe(false);
  });

  it("rejects boolean", () => {
    const result = schema.safeParse(true);
    expect(result.success).toBe(false);
  });
});
