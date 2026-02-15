import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentTimeoutSeconds, resolveAgentTimeoutMs } from "./timeout.js";

function cfg(timeoutSeconds: unknown): OpenClawConfig {
  return { agents: { defaults: { timeoutSeconds } } } as unknown as OpenClawConfig;
}

describe("resolveAgentTimeoutSeconds", () => {
  it("returns default 600 when no config", () => {
    expect(resolveAgentTimeoutSeconds()).toBe(600);
    expect(resolveAgentTimeoutSeconds(undefined)).toBe(600);
  });

  it("returns configured value", () => {
    expect(resolveAgentTimeoutSeconds(cfg(300))).toBe(300);
  });

  it("clamps to minimum 1", () => {
    expect(resolveAgentTimeoutSeconds(cfg(0))).toBe(1);
    expect(resolveAgentTimeoutSeconds(cfg(-5))).toBe(1);
  });

  it("ignores non-finite values", () => {
    expect(resolveAgentTimeoutSeconds(cfg(NaN))).toBe(600);
    expect(resolveAgentTimeoutSeconds(cfg(Infinity))).toBe(600);
  });

  it("floors fractional values", () => {
    expect(resolveAgentTimeoutSeconds(cfg(300.7))).toBe(300);
  });
});

describe("resolveAgentTimeoutMs", () => {
  it("returns default from config in ms", () => {
    const result = resolveAgentTimeoutMs({});
    expect(result).toBe(600_000);
  });

  it("uses overrideMs when provided", () => {
    expect(resolveAgentTimeoutMs({ overrideMs: 5000 })).toBe(5000);
  });

  it("uses overrideSeconds when provided", () => {
    expect(resolveAgentTimeoutMs({ overrideSeconds: 10 })).toBe(10_000);
  });

  it("overrideMs=0 means no timeout (max safe)", () => {
    const result = resolveAgentTimeoutMs({ overrideMs: 0 });
    expect(result).toBe(2_147_000_000);
  });

  it("overrideSeconds=0 means no timeout (max safe)", () => {
    const result = resolveAgentTimeoutMs({ overrideSeconds: 0 });
    expect(result).toBe(2_147_000_000);
  });

  it("negative overrideMs falls back to default", () => {
    const result = resolveAgentTimeoutMs({ overrideMs: -1 });
    expect(result).toBe(600_000);
  });

  it("negative overrideSeconds falls back to default", () => {
    const result = resolveAgentTimeoutMs({ overrideSeconds: -1 });
    expect(result).toBe(600_000);
  });

  it("clamps to MAX_SAFE_TIMEOUT_MS", () => {
    const result = resolveAgentTimeoutMs({ overrideMs: 999_999_999_999 });
    expect(result).toBe(2_147_000_000);
  });

  it("respects minMs", () => {
    const result = resolveAgentTimeoutMs({ overrideMs: 100, minMs: 500 });
    expect(result).toBe(500);
  });
});
