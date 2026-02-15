import { describe, expect, it } from "vitest";
import { ALLOWED_LOG_LEVELS, normalizeLogLevel, levelToMinLevel } from "./levels.js";

describe("ALLOWED_LOG_LEVELS", () => {
  it("contains all expected levels", () => {
    expect(ALLOWED_LOG_LEVELS).toContain("silent");
    expect(ALLOWED_LOG_LEVELS).toContain("fatal");
    expect(ALLOWED_LOG_LEVELS).toContain("error");
    expect(ALLOWED_LOG_LEVELS).toContain("warn");
    expect(ALLOWED_LOG_LEVELS).toContain("info");
    expect(ALLOWED_LOG_LEVELS).toContain("debug");
    expect(ALLOWED_LOG_LEVELS).toContain("trace");
  });

  it("has exactly 7 levels", () => {
    expect(ALLOWED_LOG_LEVELS).toHaveLength(7);
  });
});

describe("normalizeLogLevel", () => {
  it("returns the level when it is valid", () => {
    expect(normalizeLogLevel("debug")).toBe("debug");
  });

  it("returns fallback when level is undefined", () => {
    expect(normalizeLogLevel(undefined)).toBe("info");
  });

  it("returns custom fallback when level is undefined", () => {
    expect(normalizeLogLevel(undefined, "error")).toBe("error");
  });

  it("returns fallback for invalid level string", () => {
    expect(normalizeLogLevel("invalid-level")).toBe("info");
  });

  it("returns custom fallback for invalid level", () => {
    expect(normalizeLogLevel("garbage", "warn")).toBe("warn");
  });

  it("trims whitespace from level", () => {
    expect(normalizeLogLevel("  debug  ")).toBe("debug");
  });

  it("uses fallback for empty string", () => {
    expect(normalizeLogLevel("")).toBe("info");
  });

  it("handles all valid levels correctly", () => {
    for (const level of ALLOWED_LOG_LEVELS) {
      expect(normalizeLogLevel(level)).toBe(level);
    }
  });
});

describe("levelToMinLevel", () => {
  it("returns 0 for fatal", () => {
    expect(levelToMinLevel("fatal")).toBe(0);
  });

  it("returns 1 for error", () => {
    expect(levelToMinLevel("error")).toBe(1);
  });

  it("returns 2 for warn", () => {
    expect(levelToMinLevel("warn")).toBe(2);
  });

  it("returns 3 for info", () => {
    expect(levelToMinLevel("info")).toBe(3);
  });

  it("returns 4 for debug", () => {
    expect(levelToMinLevel("debug")).toBe(4);
  });

  it("returns 5 for trace", () => {
    expect(levelToMinLevel("trace")).toBe(5);
  });

  it("returns Infinity for silent", () => {
    expect(levelToMinLevel("silent")).toBe(Number.POSITIVE_INFINITY);
  });

  it("maintains ordering: fatal < error < warn < info < debug < trace", () => {
    expect(levelToMinLevel("fatal")).toBeLessThan(levelToMinLevel("error"));
    expect(levelToMinLevel("error")).toBeLessThan(levelToMinLevel("warn"));
    expect(levelToMinLevel("warn")).toBeLessThan(levelToMinLevel("info"));
    expect(levelToMinLevel("info")).toBeLessThan(levelToMinLevel("debug"));
    expect(levelToMinLevel("debug")).toBeLessThan(levelToMinLevel("trace"));
    expect(levelToMinLevel("trace")).toBeLessThan(levelToMinLevel("silent"));
  });
});
