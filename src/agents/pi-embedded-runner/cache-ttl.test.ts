import { describe, expect, it } from "vitest";
import {
  isCacheTtlEligibleProvider,
  readLastCacheTtlTimestamp,
  CACHE_TTL_CUSTOM_TYPE,
} from "./cache-ttl.js";

describe("isCacheTtlEligibleProvider", () => {
  it("returns true for anthropic", () => {
    expect(isCacheTtlEligibleProvider("anthropic", "claude-3")).toBe(true);
  });

  it("returns true for Anthropic (case insensitive)", () => {
    expect(isCacheTtlEligibleProvider("Anthropic", "claude-3")).toBe(true);
  });

  it("returns true for openrouter with anthropic/ prefix", () => {
    expect(isCacheTtlEligibleProvider("openrouter", "anthropic/claude-3")).toBe(true);
  });

  it("returns false for openrouter without anthropic/ prefix", () => {
    expect(isCacheTtlEligibleProvider("openrouter", "meta-llama/llama-3")).toBe(false);
  });

  it("returns false for other providers", () => {
    expect(isCacheTtlEligibleProvider("openai", "gpt-4")).toBe(false);
    expect(isCacheTtlEligibleProvider("google", "gemini-pro")).toBe(false);
  });
});

describe("readLastCacheTtlTimestamp", () => {
  it("returns null for null session manager", () => {
    expect(readLastCacheTtlTimestamp(null)).toBeNull();
  });

  it("returns null for session manager without getEntries", () => {
    expect(readLastCacheTtlTimestamp({})).toBeNull();
  });

  it("returns null for empty entries", () => {
    expect(readLastCacheTtlTimestamp({ getEntries: () => [] })).toBeNull();
  });

  it("returns timestamp from last cache-ttl entry", () => {
    const entries = [
      { type: "message", customType: undefined, data: undefined },
      {
        type: "custom",
        customType: CACHE_TTL_CUSTOM_TYPE,
        data: { timestamp: 1000 },
      },
      {
        type: "custom",
        customType: CACHE_TTL_CUSTOM_TYPE,
        data: { timestamp: 2000 },
      },
    ];
    expect(readLastCacheTtlTimestamp({ getEntries: () => entries })).toBe(2000);
  });

  it("skips entries with invalid timestamps", () => {
    const entries = [
      {
        type: "custom",
        customType: CACHE_TTL_CUSTOM_TYPE,
        data: { timestamp: 1000 },
      },
      {
        type: "custom",
        customType: CACHE_TTL_CUSTOM_TYPE,
        data: { timestamp: "not-a-number" },
      },
    ];
    expect(readLastCacheTtlTimestamp({ getEntries: () => entries })).toBe(1000);
  });

  it("returns null when getEntries throws", () => {
    expect(
      readLastCacheTtlTimestamp({
        getEntries: () => {
          throw new Error("broken");
        },
      }),
    ).toBeNull();
  });
});

describe("CACHE_TTL_CUSTOM_TYPE", () => {
  it("has expected value", () => {
    expect(CACHE_TTL_CUSTOM_TYPE).toBe("openclaw.cache-ttl");
  });
});
