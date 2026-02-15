import { describe, expect, it } from "vitest";
import {
  truncateToolResultText,
  calculateMaxToolResultChars,
  HARD_MAX_TOOL_RESULT_CHARS,
} from "./tool-result-truncation.js";

describe("truncateToolResultText", () => {
  it("returns text unchanged if under limit", () => {
    expect(truncateToolResultText("short", 1000)).toBe("short");
  });

  it("truncates text over limit with suffix", () => {
    const text = "x".repeat(5000);
    const result = truncateToolResultText(text, 3000);
    expect(result.length).toBeLessThan(5000);
    expect(result).toContain("truncated");
  });

  it("tries to break at newline boundary", () => {
    const lines = Array(100).fill("line of text here").join("\n");
    const result = truncateToolResultText(lines, 500);
    // Should end at a newline boundary before the truncation suffix
    expect(result).toContain("truncated");
  });

  it("preserves at least MIN_KEEP_CHARS", () => {
    const text = "x".repeat(10000);
    const result = truncateToolResultText(text, 100);
    // Should keep at least 2000 chars
    expect(result.length).toBeGreaterThan(2000);
  });
});

describe("calculateMaxToolResultChars", () => {
  it("calculates based on context window", () => {
    // 200K tokens * 0.3 share * 4 chars/token = 240K
    const result = calculateMaxToolResultChars(200_000);
    expect(result).toBe(240_000);
  });

  it("caps at HARD_MAX_TOOL_RESULT_CHARS for large windows", () => {
    const result = calculateMaxToolResultChars(2_000_000);
    expect(result).toBe(HARD_MAX_TOOL_RESULT_CHARS);
  });

  it("handles small context windows", () => {
    const result = calculateMaxToolResultChars(8_000);
    expect(result).toBe(Math.floor(8_000 * 0.3) * 4);
  });
});

describe("HARD_MAX_TOOL_RESULT_CHARS", () => {
  it("has expected value", () => {
    expect(HARD_MAX_TOOL_RESULT_CHARS).toBe(400_000);
  });
});
