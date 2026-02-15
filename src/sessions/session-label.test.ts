import { describe, expect, it } from "vitest";
import { parseSessionLabel, SESSION_LABEL_MAX_LENGTH } from "./session-label.js";

describe("parseSessionLabel", () => {
  it("rejects non-string input", () => {
    expect(parseSessionLabel(123)).toEqual({ ok: false, error: "invalid label: must be a string" });
    expect(parseSessionLabel(null)).toEqual({
      ok: false,
      error: "invalid label: must be a string",
    });
    expect(parseSessionLabel(undefined)).toEqual({
      ok: false,
      error: "invalid label: must be a string",
    });
    expect(parseSessionLabel(true)).toEqual({
      ok: false,
      error: "invalid label: must be a string",
    });
    expect(parseSessionLabel({})).toEqual({ ok: false, error: "invalid label: must be a string" });
  });

  it("rejects empty or whitespace-only strings", () => {
    expect(parseSessionLabel("")).toEqual({ ok: false, error: "invalid label: empty" });
    expect(parseSessionLabel("   ")).toEqual({ ok: false, error: "invalid label: empty" });
    expect(parseSessionLabel("\t\n")).toEqual({ ok: false, error: "invalid label: empty" });
  });

  it("rejects strings exceeding max length", () => {
    const long = "a".repeat(SESSION_LABEL_MAX_LENGTH + 1);
    const result = parseSessionLabel(long);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("too long");
      expect(result.error).toContain(String(SESSION_LABEL_MAX_LENGTH));
    }
  });

  it("accepts valid labels", () => {
    expect(parseSessionLabel("my-session")).toEqual({ ok: true, label: "my-session" });
    expect(parseSessionLabel("Session 1")).toEqual({ ok: true, label: "Session 1" });
  });

  it("trims whitespace from valid labels", () => {
    expect(parseSessionLabel("  hello  ")).toEqual({ ok: true, label: "hello" });
    expect(parseSessionLabel("\tworld\n")).toEqual({ ok: true, label: "world" });
  });

  it("accepts labels at exactly max length", () => {
    const exact = "a".repeat(SESSION_LABEL_MAX_LENGTH);
    expect(parseSessionLabel(exact)).toEqual({ ok: true, label: exact });
  });

  it("exports SESSION_LABEL_MAX_LENGTH as 64", () => {
    expect(SESSION_LABEL_MAX_LENGTH).toBe(64);
  });
});
