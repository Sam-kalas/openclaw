import { describe, expect, it } from "vitest";
import { parseAbsoluteTimeMs } from "./parse.js";

describe("parseAbsoluteTimeMs", () => {
  it("returns null for empty input", () => {
    expect(parseAbsoluteTimeMs("")).toBeNull();
    expect(parseAbsoluteTimeMs("  ")).toBeNull();
  });

  it("parses pure numeric strings as epoch ms", () => {
    expect(parseAbsoluteTimeMs("1700000000000")).toBe(1700000000000);
    expect(parseAbsoluteTimeMs("1")).toBe(1);
  });

  it("rejects zero as a pure numeric epoch (falls through to Date.parse)", () => {
    // "0" fails the n > 0 check, but Date.parse("0") succeeds (year 2000)
    const result = parseAbsoluteTimeMs("0");
    expect(result).toBe(Date.parse("0"));
  });

  it("handles negative numeric strings via Date.parse fallback", () => {
    // "-1" is not a pure digit string, goes to Date.parse("-1") which is valid (year -1)
    const result = parseAbsoluteTimeMs("-1");
    expect(result).toBe(Date.parse("-1"));
  });

  it("parses ISO 8601 date-time with timezone", () => {
    const expected = Date.parse("2026-01-15T12:00:00Z");
    expect(parseAbsoluteTimeMs("2026-01-15T12:00:00Z")).toBe(expected);
  });

  it("parses ISO 8601 date-time with offset", () => {
    const expected = Date.parse("2026-01-15T12:00:00+02:00");
    expect(parseAbsoluteTimeMs("2026-01-15T12:00:00+02:00")).toBe(expected);
  });

  it("appends Z to ISO date-time without timezone", () => {
    const expected = Date.parse("2026-01-15T12:00:00Z");
    expect(parseAbsoluteTimeMs("2026-01-15T12:00:00")).toBe(expected);
  });

  it("converts ISO date-only to midnight UTC", () => {
    const expected = Date.parse("2026-01-15T00:00:00Z");
    expect(parseAbsoluteTimeMs("2026-01-15")).toBe(expected);
  });

  it("handles ISO date-time with fractional seconds", () => {
    const expected = Date.parse("2026-01-15T12:30:45.123Z");
    expect(parseAbsoluteTimeMs("2026-01-15T12:30:45.123Z")).toBe(expected);
  });

  it("returns null for unparseable strings", () => {
    expect(parseAbsoluteTimeMs("not-a-date")).toBeNull();
    expect(parseAbsoluteTimeMs("abc123")).toBeNull();
  });

  it("trims whitespace before parsing", () => {
    const expected = Date.parse("2026-01-15T00:00:00Z");
    expect(parseAbsoluteTimeMs("  2026-01-15  ")).toBe(expected);
  });
});
