import { describe, expect, it } from "vitest";
import {
  normalizeTextForComparison,
  isMessagingToolDuplicate,
  isMessagingToolDuplicateNormalized,
} from "./messaging-dedupe.js";

describe("normalizeTextForComparison", () => {
  it("trims and lowercases", () => {
    expect(normalizeTextForComparison("  Hello World  ")).toBe("hello world");
  });

  it("strips emoji", () => {
    expect(normalizeTextForComparison("Hello 👋 World 🌍")).toBe("hello world");
  });

  it("collapses whitespace", () => {
    expect(normalizeTextForComparison("hello   world\nfoo")).toBe("hello world foo");
  });

  it("handles empty string", () => {
    expect(normalizeTextForComparison("")).toBe("");
  });

  it("handles only emoji", () => {
    const result = normalizeTextForComparison("🎉🎊");
    expect(result).toBe("");
  });
});

describe("isMessagingToolDuplicateNormalized", () => {
  it("returns false for empty sentTexts", () => {
    expect(isMessagingToolDuplicateNormalized("some text here", [])).toBe(false);
  });

  it("returns false for short text", () => {
    expect(isMessagingToolDuplicateNormalized("hi", ["hi there"])).toBe(false);
  });

  it("detects exact match", () => {
    expect(isMessagingToolDuplicateNormalized("hello there world", ["hello there world"])).toBe(
      true,
    );
  });

  it("detects substring match (sent includes normalized)", () => {
    expect(
      isMessagingToolDuplicateNormalized("hello there world", ["hello there world and more"]),
    ).toBe(true);
  });

  it("detects substring match (normalized includes sent)", () => {
    expect(
      isMessagingToolDuplicateNormalized("hello there world and more text", ["hello there world"]),
    ).toBe(true);
  });

  it("returns false for non-matching text", () => {
    expect(
      isMessagingToolDuplicateNormalized("hello there world", ["completely different text"]),
    ).toBe(false);
  });
});

describe("isMessagingToolDuplicate", () => {
  it("returns false for empty sentTexts", () => {
    expect(isMessagingToolDuplicate("hello world test", [])).toBe(false);
  });

  it("detects duplicate with normalization", () => {
    expect(isMessagingToolDuplicate("  Hello World Test  ", ["hello world test"])).toBe(true);
  });

  it("returns false for short text", () => {
    expect(isMessagingToolDuplicate("hi", ["hi"])).toBe(false);
  });

  it("ignores emoji when comparing", () => {
    expect(isMessagingToolDuplicate("Hello World 👋 Test!", ["hello world test!"])).toBe(true);
  });
});
