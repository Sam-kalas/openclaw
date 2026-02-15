import { describe, expect, it } from "vitest";
import {
  clampPercent,
  PROVIDER_LABELS,
  usageProviders,
  ignoredErrors,
} from "./provider-usage.shared.js";

describe("clampPercent", () => {
  it("clamps values below 0 to 0", () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(-0.01)).toBe(0);
  });

  it("clamps values above 100 to 100", () => {
    expect(clampPercent(110)).toBe(100);
    expect(clampPercent(200)).toBe(100);
  });

  it("passes through values in range", () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(100)).toBe(100);
    expect(clampPercent(33.3)).toBe(33.3);
  });

  it("handles non-finite values", () => {
    expect(clampPercent(NaN)).toBe(0);
    expect(clampPercent(Infinity)).toBe(0);
    expect(clampPercent(-Infinity)).toBe(0);
  });
});

describe("PROVIDER_LABELS", () => {
  it("has labels for all usage providers", () => {
    for (const provider of usageProviders) {
      expect(PROVIDER_LABELS[provider]).toBeDefined();
      expect(typeof PROVIDER_LABELS[provider]).toBe("string");
    }
  });

  it("maps anthropic to Claude", () => {
    expect(PROVIDER_LABELS.anthropic).toBe("Claude");
  });

  it("maps zai to z.ai", () => {
    expect(PROVIDER_LABELS.zai).toBe("z.ai");
  });
});

describe("ignoredErrors", () => {
  it("contains expected error strings", () => {
    expect(ignoredErrors.has("No credentials")).toBe(true);
    expect(ignoredErrors.has("No token")).toBe(true);
    expect(ignoredErrors.has("No API key")).toBe(true);
    expect(ignoredErrors.has("Not logged in")).toBe(true);
    expect(ignoredErrors.has("No auth")).toBe(true);
  });

  it("does not contain arbitrary strings", () => {
    expect(ignoredErrors.has("random error")).toBe(false);
  });
});
