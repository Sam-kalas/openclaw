import { describe, expect, it } from "vitest";
import { validateJsonSchemaValue } from "./schema-validator.js";

describe("validateJsonSchemaValue", () => {
  const stringSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
    additionalProperties: false,
  };

  it("returns ok for valid value", () => {
    const result = validateJsonSchemaValue({
      schema: stringSchema,
      cacheKey: "test-1",
      value: { name: "Alice", age: 30 },
    });
    expect(result.ok).toBe(true);
  });

  it("returns error for missing required field", () => {
    const result = validateJsonSchemaValue({
      schema: stringSchema,
      cacheKey: "test-2",
      value: { age: 30 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("returns error for wrong type", () => {
    const result = validateJsonSchemaValue({
      schema: stringSchema,
      cacheKey: "test-3",
      value: { name: 123 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("name"))).toBe(true);
    }
  });

  it("returns error for additional properties", () => {
    const result = validateJsonSchemaValue({
      schema: stringSchema,
      cacheKey: "test-4",
      value: { name: "Alice", extra: true },
    });
    expect(result.ok).toBe(false);
  });

  it("uses cached validator for same cacheKey", () => {
    // First call compiles schema
    const result1 = validateJsonSchemaValue({
      schema: stringSchema,
      cacheKey: "test-cached",
      value: { name: "Alice" },
    });
    expect(result1.ok).toBe(true);

    // Second call with same key should use cache
    const result2 = validateJsonSchemaValue({
      schema: stringSchema,
      cacheKey: "test-cached",
      value: { name: "Bob" },
    });
    expect(result2.ok).toBe(true);
  });

  it("returns formatted error paths", () => {
    const nestedSchema = {
      type: "object",
      properties: {
        settings: {
          type: "object",
          properties: {
            count: { type: "number" },
          },
        },
      },
    };
    const result = validateJsonSchemaValue({
      schema: nestedSchema,
      cacheKey: "test-nested",
      value: { settings: { count: "not-a-number" } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("settings"))).toBe(true);
    }
  });

  it("handles empty errors array gracefully", () => {
    // Test with allErrors: true mode (ajv), use a simple always-valid schema
    const simpleSchema = { type: "string" };
    const result = validateJsonSchemaValue({
      schema: simpleSchema,
      cacheKey: "test-simple",
      value: 42,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
