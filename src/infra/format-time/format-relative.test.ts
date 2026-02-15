import { describe, expect, it } from "vitest";
import { formatTimeAgo, formatRelativeTimestamp } from "./format-relative.js";

describe("formatTimeAgo", () => {
  it("returns 'just now' for 0ms", () => {
    expect(formatTimeAgo(0)).toBe("just now");
  });

  it("rounds near-minute values to 1m", () => {
    expect(formatTimeAgo(30000)).toBe("1m ago"); // 30s rounds to 1m
    expect(formatTimeAgo(59000)).toBe("1m ago"); // 59s rounds to 1m
  });

  it("formats minutes", () => {
    expect(formatTimeAgo(5 * 60000)).toBe("5m ago");
    expect(formatTimeAgo(30 * 60000)).toBe("30m ago");
  });

  it("formats hours", () => {
    expect(formatTimeAgo(2 * 3600000)).toBe("2h ago");
    expect(formatTimeAgo(23 * 3600000)).toBe("23h ago");
  });

  it("formats days", () => {
    expect(formatTimeAgo(3 * 86400000)).toBe("3d ago");
  });

  it("returns fallback for null/undefined", () => {
    expect(formatTimeAgo(null)).toBe("unknown");
    expect(formatTimeAgo(undefined)).toBe("unknown");
  });

  it("returns fallback for negative", () => {
    expect(formatTimeAgo(-1000)).toBe("unknown");
  });

  it("returns fallback for NaN", () => {
    expect(formatTimeAgo(NaN)).toBe("unknown");
  });

  it("respects custom fallback", () => {
    expect(formatTimeAgo(null, { fallback: "n/a" })).toBe("n/a");
  });

  it("omits ago suffix when suffix=false", () => {
    expect(formatTimeAgo(0, { suffix: false })).toBe("0s");
    expect(formatTimeAgo(5 * 60000, { suffix: false })).toBe("5m");
    expect(formatTimeAgo(2 * 3600000, { suffix: false })).toBe("2h");
    expect(formatTimeAgo(3 * 86400000, { suffix: false })).toBe("3d");
  });
});

describe("formatRelativeTimestamp", () => {
  it("returns fallback for null", () => {
    expect(formatRelativeTimestamp(null)).toBe("n/a");
    expect(formatRelativeTimestamp(undefined)).toBe("n/a");
  });

  it("returns custom fallback", () => {
    expect(formatRelativeTimestamp(null, { fallback: "?" })).toBe("?");
  });

  it("formats recent past timestamps", () => {
    const now = Date.now();
    const result = formatRelativeTimestamp(now - 5 * 60000);
    expect(result).toBe("5m ago");
  });

  it("formats recent future timestamps", () => {
    const now = Date.now();
    const result = formatRelativeTimestamp(now + 5 * 60000);
    expect(result).toBe("in 5m");
  });

  it("formats 'just now' for very recent past", () => {
    const result = formatRelativeTimestamp(Date.now() - 10000);
    expect(result).toBe("just now");
  });

  it("formats future less than a minute as 'in <1m'", () => {
    const result = formatRelativeTimestamp(Date.now() + 10000);
    expect(result).toBe("in <1m");
  });
});

describe("formatRelativeTimestamp dateFallback", () => {
  it("returns day format for old timestamps without dateFallback", () => {
    const old = Date.now() - 10 * 86400000;
    const result = formatRelativeTimestamp(old);
    expect(result).toMatch(/\d+d ago/);
  });

  it("returns short date for old timestamps with dateFallback", () => {
    const old = Date.now() - 10 * 86400000;
    const result = formatRelativeTimestamp(old, { dateFallback: true });
    // Should be like "Feb 5" or similar
    expect(result).toMatch(/[A-Z][a-z]+ \d+/);
  });
});
