import { describe, expect, it } from "vitest";
import { cleanSchemaForGemini, GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS } from "./clean-for-gemini.js";

type Schema = Record<string, unknown>;

describe("GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS", () => {
  it("contains expected keywords", () => {
    expect(GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS.has("$ref")).toBe(true);
    expect(GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS.has("$schema")).toBe(true);
    expect(GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS.has("additionalProperties")).toBe(true);
    expect(GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS.has("patternProperties")).toBe(true);
    expect(GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS.has("minLength")).toBe(true);
    expect(GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS.has("maxLength")).toBe(true);
    expect(GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS.has("format")).toBe(true);
  });
});

describe("cleanSchemaForGemini", () => {
  it("returns primitives unchanged", () => {
    expect(cleanSchemaForGemini(null)).toBeNull();
    expect(cleanSchemaForGemini(undefined)).toBeUndefined();
    expect(cleanSchemaForGemini("string")).toBe("string");
    expect(cleanSchemaForGemini(42)).toBe(42);
  });

  it("strips unsupported keywords", () => {
    const schema = {
      type: "string",
      minLength: 1,
      maxLength: 100,
      format: "email",
      pattern: ".*",
      description: "An email",
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    expect(result.type).toBe("string");
    expect(result.description).toBe("An email");
    expect(result.minLength).toBeUndefined();
    expect(result.maxLength).toBeUndefined();
    expect(result.format).toBeUndefined();
    expect(result.pattern).toBeUndefined();
  });

  it("strips additionalProperties", () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
      additionalProperties: false,
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    expect(result.additionalProperties).toBeUndefined();
    expect(result.type).toBe("object");
  });

  it("converts const to enum", () => {
    const schema = { const: "hello" };
    const result = cleanSchemaForGemini(schema) as Schema;
    expect(result.enum).toEqual(["hello"]);
    expect(result.const).toBeUndefined();
  });

  it("flattens anyOf with literal values to enum", () => {
    const schema = {
      anyOf: [
        { const: "a", type: "string" },
        { const: "b", type: "string" },
        { const: "c", type: "string" },
      ],
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    expect(result.type).toBe("string");
    expect(result.enum).toEqual(["a", "b", "c"]);
  });

  it("flattens oneOf with literal values to enum", () => {
    const schema = {
      oneOf: [
        { const: "x", type: "string" },
        { const: "y", type: "string" },
      ],
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    expect(result.type).toBe("string");
    expect(result.enum).toEqual(["x", "y"]);
  });

  it("strips null variants from anyOf", () => {
    const schema = {
      anyOf: [{ type: "string" }, { type: "null" }],
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    expect(result.type).toBe("string");
    expect(result.anyOf).toBeUndefined();
  });

  it("strips null schema with const null", () => {
    const schema = {
      anyOf: [{ type: "string" }, { const: null }],
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    expect(result.type).toBe("string");
  });

  it("cleans nested properties recursively", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        age: { type: "number", minimum: 0 },
      },
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    const props = result.properties as Record<string, Schema>;
    expect(props.name.type).toBe("string");
    expect(props.name.minLength).toBeUndefined();
    expect(props.age.minimum).toBeUndefined();
  });

  it("cleans items schema recursively", () => {
    const schema = {
      type: "array",
      items: { type: "string", minLength: 1 },
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    const items = result.items as Schema;
    expect(items.type).toBe("string");
    expect(items.minLength).toBeUndefined();
  });

  it("resolves $ref to local $defs", () => {
    const schema = {
      $defs: {
        Color: { type: "string", description: "A color" },
      },
      type: "object",
      properties: {
        favorite: { $ref: "#/$defs/Color" },
      },
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    const props = result.properties as Record<string, Schema>;
    expect(props.favorite.type).toBe("string");
    expect(props.favorite.description).toBe("A color");
    expect(props.favorite.$ref).toBeUndefined();
  });

  it("handles array type with null removed", () => {
    const schema = { type: ["string", "null"] };
    const result = cleanSchemaForGemini(schema) as Schema;
    expect(result.type).toBe("string");
  });

  it("handles circular $ref gracefully", () => {
    const schema = {
      $defs: {
        Node: {
          type: "object",
          properties: {
            child: { $ref: "#/$defs/Node" },
          },
        },
      },
      $ref: "#/$defs/Node",
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    expect(result.type).toBe("object");
    const props = result.properties as Record<string, Schema>;
    expect(props.child).toBeDefined();
  });

  it("processes arrays of schemas", () => {
    const schemas = [
      { type: "string", minLength: 1 },
      { type: "number", minimum: 0 },
    ];
    const result = cleanSchemaForGemini(schemas) as Schema[];
    expect(result).toHaveLength(2);
    expect(result[0].minLength).toBeUndefined();
    expect(result[1].minimum).toBeUndefined();
  });

  it("strips $schema, $id, definitions", () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "test",
      definitions: { Foo: { type: "string" } },
      type: "object",
    };
    const result = cleanSchemaForGemini(schema) as Schema;
    expect(result.$schema).toBeUndefined();
    expect(result.$id).toBeUndefined();
    expect(result.definitions).toBeUndefined();
    expect(result.type).toBe("object");
  });
});
