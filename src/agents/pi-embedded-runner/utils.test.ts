import { describe, expect, it } from "vitest";
import { mapThinkingLevel, describeUnknownError } from "./utils.js";

describe("mapThinkingLevel", () => {
  it("returns off for undefined", () => {
    expect(mapThinkingLevel(undefined)).toBe("off");
  });

  it("returns off for falsy values", () => {
    expect(mapThinkingLevel(undefined)).toBe("off");
  });

  it("passes through valid levels", () => {
    expect(mapThinkingLevel("low")).toBe("low");
    expect(mapThinkingLevel("medium")).toBe("medium");
    expect(mapThinkingLevel("high")).toBe("high");
    expect(mapThinkingLevel("xhigh")).toBe("xhigh");
  });
});

describe("describeUnknownError", () => {
  it("returns message from Error", () => {
    expect(describeUnknownError(new Error("test error"))).toBe("test error");
  });

  it("returns string directly", () => {
    expect(describeUnknownError("string error")).toBe("string error");
  });

  it("serializes objects", () => {
    const result = describeUnknownError({ code: 42 });
    expect(result).toContain("42");
  });

  it("handles null", () => {
    expect(describeUnknownError(null)).toBe("null");
  });

  it("handles undefined", () => {
    const result = describeUnknownError(undefined);
    expect(result).toBeTruthy();
  });

  it("handles circular references gracefully", () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    const result = describeUnknownError(obj);
    expect(result).toBe("Unknown error");
  });
});
