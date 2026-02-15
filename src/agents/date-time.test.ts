import { describe, expect, it } from "vitest";
import { normalizeTimestamp, withNormalizedTimestamp, formatUserTime } from "./date-time.js";

describe("normalizeTimestamp", () => {
  it("returns undefined for null/undefined", () => {
    expect(normalizeTimestamp(null)).toBeUndefined();
    expect(normalizeTimestamp(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizeTimestamp("")).toBeUndefined();
    expect(normalizeTimestamp("  ")).toBeUndefined();
  });

  it("handles Date objects", () => {
    const date = new Date("2025-01-15T12:00:00Z");
    const result = normalizeTimestamp(date);
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(date.getTime());
    expect(result!.timestampUtc).toBe(date.toISOString());
  });

  it("handles millisecond timestamps as numbers", () => {
    const ms = 1705320000000; // 2024-01-15T12:00:00Z
    const result = normalizeTimestamp(ms);
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(ms);
  });

  it("handles second timestamps as numbers (auto-detects)", () => {
    const sec = 1705320000; // < 1_000_000_000_000, so treated as seconds
    const result = normalizeTimestamp(sec);
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(sec * 1000);
  });

  it("handles ISO date strings", () => {
    const result = normalizeTimestamp("2025-01-15T12:00:00Z");
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(Date.parse("2025-01-15T12:00:00Z"));
  });

  it("handles numeric strings (milliseconds by length)", () => {
    const result = normalizeTimestamp("1705320000000");
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(1705320000000);
  });

  it("handles numeric strings with decimal (seconds)", () => {
    const result = normalizeTimestamp("1705320000.5");
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(Math.round(1705320000.5 * 1000));
  });

  it("handles short numeric strings as seconds", () => {
    const result = normalizeTimestamp("1705320000");
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(1705320000 * 1000);
  });

  it("returns undefined for non-finite numbers", () => {
    expect(normalizeTimestamp(NaN)).toBeUndefined();
    expect(normalizeTimestamp(Infinity)).toBeUndefined();
  });

  it("returns undefined for invalid date strings", () => {
    expect(normalizeTimestamp("not-a-date")).toBeUndefined();
  });
});

describe("withNormalizedTimestamp", () => {
  it("adds timestamp fields from raw value", () => {
    const result = withNormalizedTimestamp({ foo: "bar" }, 1705320000000);
    expect(result.foo).toBe("bar");
    expect(result.timestampMs).toBe(1705320000000);
    expect(result.timestampUtc).toBeDefined();
  });

  it("preserves existing timestampMs if already set", () => {
    const result = withNormalizedTimestamp({ timestampMs: 999 }, 1705320000000);
    expect(result.timestampMs).toBe(999);
  });

  it("preserves existing timestampUtc if already set", () => {
    const result = withNormalizedTimestamp({ timestampUtc: "existing" }, 1705320000000);
    expect(result.timestampUtc).toBe("existing");
  });

  it("returns original value if raw timestamp is invalid", () => {
    const original = { foo: "bar" };
    const result = withNormalizedTimestamp(original, null);
    expect(result).toBe(original);
  });
});

describe("formatUserTime", () => {
  it("formats date in 12-hour mode", () => {
    const date = new Date("2025-06-15T14:30:00Z");
    const result = formatUserTime(date, "UTC", "12");
    expect(result).toBeDefined();
    expect(result).toContain("Sunday");
    expect(result).toContain("June");
    expect(result).toContain("15th");
    expect(result).toContain("2025");
    expect(result).toMatch(/2:30\s*PM/);
  });

  it("formats date in 24-hour mode", () => {
    const date = new Date("2025-06-15T14:30:00Z");
    const result = formatUserTime(date, "UTC", "24");
    expect(result).toBeDefined();
    expect(result).toContain("14:30");
    expect(result).not.toContain("PM");
  });

  it("handles ordinal suffixes correctly", () => {
    // 1st
    const jan1 = new Date("2025-01-01T12:00:00Z");
    expect(formatUserTime(jan1, "UTC", "12")).toContain("1st");

    // 2nd
    const jan2 = new Date("2025-01-02T12:00:00Z");
    expect(formatUserTime(jan2, "UTC", "12")).toContain("2nd");

    // 3rd
    const jan3 = new Date("2025-01-03T12:00:00Z");
    expect(formatUserTime(jan3, "UTC", "12")).toContain("3rd");

    // 11th (special case)
    const jan11 = new Date("2025-01-11T12:00:00Z");
    expect(formatUserTime(jan11, "UTC", "12")).toContain("11th");

    // 12th (special case)
    const jan12 = new Date("2025-01-12T12:00:00Z");
    expect(formatUserTime(jan12, "UTC", "12")).toContain("12th");

    // 13th (special case)
    const jan13 = new Date("2025-01-13T12:00:00Z");
    expect(formatUserTime(jan13, "UTC", "12")).toContain("13th");

    // 21st
    const jan21 = new Date("2025-01-21T12:00:00Z");
    expect(formatUserTime(jan21, "UTC", "12")).toContain("21st");
  });
});
