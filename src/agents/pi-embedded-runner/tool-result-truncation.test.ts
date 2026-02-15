import { describe, expect, it } from "vitest";
import {
  truncateToolResultText,
  calculateMaxToolResultChars,
  HARD_MAX_TOOL_RESULT_CHARS,
  truncateOversizedToolResultsInMessages,
  isOversizedToolResult,
  sessionLikelyHasOversizedToolResults,
} from "./tool-result-truncation.js";

describe("truncateToolResultText", () => {
  it("returns text unchanged when under limit", () => {
    const text = "short text";
    expect(truncateToolResultText(text, 1000)).toBe(text);
  });

  it("truncates text exceeding limit", () => {
    const text = "a".repeat(5000);
    const result = truncateToolResultText(text, 3000);
    expect(result.length).toBeLessThanOrEqual(5000);
    expect(result).toContain("truncated");
  });

  it("preserves at least MIN_KEEP_CHARS (2000) chars", () => {
    const text = "a".repeat(10000);
    const result = truncateToolResultText(text, 100); // very small limit
    // Should still keep at least 2000 chars of content
    expect(result.length).toBeGreaterThan(2000);
  });

  it("tries to break at newline boundary", () => {
    // Create text with newlines near the cut point
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i}: ${"x".repeat(50)}`).join("\n");
    const result = truncateToolResultText(lines, 3000);
    // The truncation should end at a newline, not mid-line
    const contentBeforeSuffix = result.split("\n\n⚠️")[0];
    expect(
      contentBeforeSuffix.endsWith("\n") || contentBeforeSuffix.match(/line \d+: x+$/),
    ).toBeTruthy();
  });

  it("appends truncation warning suffix", () => {
    const text = "a".repeat(5000);
    const result = truncateToolResultText(text, 3000);
    expect(result).toContain("⚠️");
    expect(result).toContain("Content truncated");
  });
});

describe("calculateMaxToolResultChars", () => {
  it("returns 30% of context window in chars (tokens * 4 * 0.3)", () => {
    // 100K tokens * 0.3 * 4 = 120K chars
    expect(calculateMaxToolResultChars(100_000)).toBe(120_000);
  });

  it("caps at HARD_MAX_TOOL_RESULT_CHARS for large context windows", () => {
    // 2M tokens → would be 2_400_000 chars, but capped at 400K
    const result = calculateMaxToolResultChars(2_000_000);
    expect(result).toBe(HARD_MAX_TOOL_RESULT_CHARS);
    expect(result).toBe(400_000);
  });

  it("handles small context windows", () => {
    // 1K tokens → 1200 chars
    expect(calculateMaxToolResultChars(1_000)).toBe(1_200);
  });
});

describe("HARD_MAX_TOOL_RESULT_CHARS", () => {
  it("is 400,000", () => {
    expect(HARD_MAX_TOOL_RESULT_CHARS).toBe(400_000);
  });
});

describe("isOversizedToolResult", () => {
  it("returns false for non-toolResult messages", () => {
    const msg = { role: "user", content: "hello" } as any;
    expect(isOversizedToolResult(msg, 100_000)).toBe(false);
  });

  it("returns false for small tool results", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "abc",
      content: [{ type: "text", text: "small result" }],
    } as any;
    expect(isOversizedToolResult(msg, 100_000)).toBe(false);
  });

  it("returns true for oversized tool results", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "abc",
      content: [{ type: "text", text: "x".repeat(500_000) }],
    } as any;
    // 100K tokens → max 120K chars, 500K exceeds that
    expect(isOversizedToolResult(msg, 100_000)).toBe(true);
  });
});

describe("truncateOversizedToolResultsInMessages", () => {
  it("returns original messages when nothing is oversized", () => {
    const messages = [
      { role: "user", content: "hi" },
      {
        role: "toolResult",
        toolCallId: "a",
        content: [{ type: "text", text: "small" }],
      },
    ] as any[];
    const { messages: result, truncatedCount } = truncateOversizedToolResultsInMessages(
      messages,
      100_000,
    );
    expect(truncatedCount).toBe(0);
    expect(result[1]).toBe(messages[1]); // same reference
  });

  it("truncates oversized tool results", () => {
    const bigText = "x".repeat(500_000);
    const messages = [
      {
        role: "toolResult",
        toolCallId: "a",
        content: [{ type: "text", text: bigText }],
      },
    ] as any[];
    const { messages: result, truncatedCount } = truncateOversizedToolResultsInMessages(
      messages,
      100_000,
    );
    expect(truncatedCount).toBe(1);
    const text = (result[0] as any).content[0].text;
    expect(text.length).toBeLessThan(bigText.length);
    expect(text).toContain("truncated");
  });

  it("does not modify non-toolResult messages", () => {
    const messages = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ] as any[];
    const { messages: result, truncatedCount } = truncateOversizedToolResultsInMessages(
      messages,
      100_000,
    );
    expect(truncatedCount).toBe(0);
    expect(result[0]).toBe(messages[0]);
    expect(result[1]).toBe(messages[1]);
  });
});

describe("sessionLikelyHasOversizedToolResults", () => {
  it("returns false for empty messages", () => {
    expect(
      sessionLikelyHasOversizedToolResults({ messages: [], contextWindowTokens: 100_000 }),
    ).toBe(false);
  });

  it("returns false when no tool results exceed limit", () => {
    const messages = [
      {
        role: "toolResult",
        toolCallId: "a",
        content: [{ type: "text", text: "small" }],
      },
    ] as any[];
    expect(sessionLikelyHasOversizedToolResults({ messages, contextWindowTokens: 100_000 })).toBe(
      false,
    );
  });

  it("returns true when a tool result exceeds limit", () => {
    const messages = [
      {
        role: "toolResult",
        toolCallId: "a",
        content: [{ type: "text", text: "x".repeat(500_000) }],
      },
    ] as any[];
    expect(sessionLikelyHasOversizedToolResults({ messages, contextWindowTokens: 100_000 })).toBe(
      true,
    );
  });
});
