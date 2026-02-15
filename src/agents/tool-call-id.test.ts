import { describe, expect, it } from "vitest";
import {
  sanitizeToolCallId,
  isValidCloudCodeAssistToolId,
  sanitizeToolCallIdsForCloudCodeAssist,
} from "./tool-call-id.js";

describe("sanitizeToolCallId", () => {
  describe("strict mode (default)", () => {
    it("returns alphanumeric-only string unchanged", () => {
      expect(sanitizeToolCallId("abc123")).toBe("abc123");
    });

    it("strips non-alphanumeric characters", () => {
      expect(sanitizeToolCallId("call_123-abc")).toBe("call123abc");
    });

    it("returns fallback for empty string", () => {
      expect(sanitizeToolCallId("")).toBe("defaulttoolid");
    });

    it("returns fallback for non-string input", () => {
      expect(sanitizeToolCallId(null as unknown as string)).toBe("defaulttoolid");
      expect(sanitizeToolCallId(undefined as unknown as string)).toBe("defaulttoolid");
    });

    it("returns sanitizedtoolid when all chars are stripped", () => {
      expect(sanitizeToolCallId("---")).toBe("sanitizedtoolid");
    });
  });

  describe("strict9 mode", () => {
    it("truncates alphanumeric string to 9 chars", () => {
      expect(sanitizeToolCallId("abcdefghijklm", "strict9")).toBe("abcdefghi");
    });

    it("returns exactly 9-char string unchanged", () => {
      expect(sanitizeToolCallId("abcdefghi", "strict9")).toBe("abcdefghi");
    });

    it("hashes short alphanumeric strings to 9 chars", () => {
      const result = sanitizeToolCallId("ab", "strict9");
      expect(result).toHaveLength(9);
      expect(result).toMatch(/^[a-f0-9]{9}$/);
    });

    it("returns defaultid for empty string", () => {
      expect(sanitizeToolCallId("", "strict9")).toBe("defaultid");
    });

    it("returns defaultid for non-string input", () => {
      expect(sanitizeToolCallId(null as unknown as string, "strict9")).toBe("defaultid");
    });

    it("hashes when all non-alphanumeric chars are stripped and result is short", () => {
      const result = sanitizeToolCallId("a-b", "strict9");
      // "ab" is only 2 chars, so it gets hashed to 9
      expect(result).toHaveLength(9);
    });

    it("strips non-alphanumeric and truncates long result", () => {
      const result = sanitizeToolCallId("a1b2c3d4e5f6g7h8", "strict9");
      expect(result).toBe("a1b2c3d4e");
      expect(result).toHaveLength(9);
    });
  });
});

describe("isValidCloudCodeAssistToolId", () => {
  describe("strict mode (default)", () => {
    it("accepts alphanumeric strings", () => {
      expect(isValidCloudCodeAssistToolId("abc123")).toBe(true);
    });

    it("rejects strings with special chars", () => {
      expect(isValidCloudCodeAssistToolId("abc_123")).toBe(false);
      expect(isValidCloudCodeAssistToolId("abc-123")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidCloudCodeAssistToolId("")).toBe(false);
    });

    it("rejects non-string input", () => {
      expect(isValidCloudCodeAssistToolId(null as unknown as string)).toBe(false);
      expect(isValidCloudCodeAssistToolId(undefined as unknown as string)).toBe(false);
    });
  });

  describe("strict9 mode", () => {
    it("accepts exactly 9-char alphanumeric strings", () => {
      expect(isValidCloudCodeAssistToolId("abcdefghi", "strict9")).toBe(true);
    });

    it("rejects strings not exactly 9 chars", () => {
      expect(isValidCloudCodeAssistToolId("abcdefgh", "strict9")).toBe(false);
      expect(isValidCloudCodeAssistToolId("abcdefghij", "strict9")).toBe(false);
    });

    it("rejects 9-char strings with special chars", () => {
      expect(isValidCloudCodeAssistToolId("abcd_fghi", "strict9")).toBe(false);
    });
  });
});

describe("sanitizeToolCallIdsForCloudCodeAssist", () => {
  it("returns original array when no sanitization needed", () => {
    const messages = [
      { role: "user" as const, content: "hello" },
      { role: "assistant" as const, content: "hi" },
    ];
    const result = sanitizeToolCallIdsForCloudCodeAssist(messages as any);
    expect(result).toBe(messages); // same reference = no change
  });

  it("sanitizes tool call ids in assistant messages", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: [{ type: "toolUse", id: "call_abc-123", name: "read", input: {} }],
      },
      {
        role: "toolResult" as const,
        toolCallId: "call_abc-123",
        content: [{ type: "text", text: "ok" }],
      },
    ];
    const result = sanitizeToolCallIdsForCloudCodeAssist(messages as any);
    // The IDs should be sanitized to alphanumeric only
    const assistantContent = (result[0] as any).content[0];
    expect(assistantContent.id).toMatch(/^[a-zA-Z0-9]+$/);
    // The tool result should have the matching sanitized ID
    const toolResult = result[1] as any;
    expect(toolResult.toolCallId).toBe(assistantContent.id);
  });

  it("handles strict9 mode", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: [{ type: "functionCall", id: "long-id-with-dashes-123", name: "exec", input: {} }],
      },
      {
        role: "toolResult" as const,
        toolCallId: "long-id-with-dashes-123",
        content: [{ type: "text", text: "result" }],
      },
    ];
    const result = sanitizeToolCallIdsForCloudCodeAssist(messages as any, "strict9");
    const assistantContent = (result[0] as any).content[0];
    expect(assistantContent.id).toHaveLength(9);
    expect(assistantContent.id).toMatch(/^[a-zA-Z0-9]{9}$/);
  });

  it("deduplicates colliding sanitized IDs", () => {
    // "a|b" and "a:b" both become "ab" after stripping non-alphanumeric
    const messages = [
      {
        role: "assistant" as const,
        content: [
          { type: "toolUse", id: "a|b", name: "read", input: {} },
          { type: "toolUse", id: "a:b", name: "write", input: {} },
        ],
      },
      { role: "toolResult" as const, toolCallId: "a|b", content: [{ type: "text", text: "r1" }] },
      { role: "toolResult" as const, toolCallId: "a:b", content: [{ type: "text", text: "r2" }] },
    ];
    const result = sanitizeToolCallIdsForCloudCodeAssist(messages as any);
    const content = (result[0] as any).content;
    // Both IDs should be different after dedup
    expect(content[0].id).not.toBe(content[1].id);
    // Both should be alphanumeric
    expect(content[0].id).toMatch(/^[a-zA-Z0-9]+$/);
    expect(content[1].id).toMatch(/^[a-zA-Z0-9]+$/);
  });
});
