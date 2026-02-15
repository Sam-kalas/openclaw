import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  resolveContextWindowInfo,
  evaluateContextWindowGuard,
  CONTEXT_WINDOW_HARD_MIN_TOKENS,
  CONTEXT_WINDOW_WARN_BELOW_TOKENS,
} from "./context-window-guard.js";

describe("resolveContextWindowInfo", () => {
  it("uses modelsConfig when available", () => {
    const cfg = {
      models: {
        providers: {
          anthropic: {
            models: [{ id: "claude-3", contextWindow: 100_000 }],
          },
        },
      },
    } as unknown as OpenClawConfig;
    const result = resolveContextWindowInfo({
      cfg,
      provider: "anthropic",
      modelId: "claude-3",
      modelContextWindow: 50_000,
      defaultTokens: 200_000,
    });
    expect(result.tokens).toBe(100_000);
    expect(result.source).toBe("modelsConfig");
  });

  it("falls back to model context window", () => {
    const result = resolveContextWindowInfo({
      cfg: undefined,
      provider: "anthropic",
      modelId: "claude-3",
      modelContextWindow: 128_000,
      defaultTokens: 200_000,
    });
    expect(result.tokens).toBe(128_000);
    expect(result.source).toBe("model");
  });

  it("falls back to default tokens", () => {
    const result = resolveContextWindowInfo({
      cfg: undefined,
      provider: "anthropic",
      modelId: "claude-3",
      defaultTokens: 200_000,
    });
    expect(result.tokens).toBe(200_000);
    expect(result.source).toBe("default");
  });

  it("applies agentContextTokens cap", () => {
    const cfg = {
      agents: { defaults: { contextTokens: 50_000 } },
    } as unknown as OpenClawConfig;
    const result = resolveContextWindowInfo({
      cfg,
      provider: "anthropic",
      modelId: "claude-3",
      modelContextWindow: 200_000,
      defaultTokens: 200_000,
    });
    expect(result.tokens).toBe(50_000);
    expect(result.source).toBe("agentContextTokens");
  });

  it("ignores cap if larger than base", () => {
    const cfg = {
      agents: { defaults: { contextTokens: 500_000 } },
    } as unknown as OpenClawConfig;
    const result = resolveContextWindowInfo({
      cfg,
      provider: "anthropic",
      modelId: "claude-3",
      modelContextWindow: 200_000,
      defaultTokens: 200_000,
    });
    expect(result.tokens).toBe(200_000);
    expect(result.source).toBe("model");
  });
});

describe("evaluateContextWindowGuard", () => {
  it("returns shouldWarn=false and shouldBlock=false for large window", () => {
    const result = evaluateContextWindowGuard({
      info: { tokens: 200_000, source: "model" },
    });
    expect(result.shouldWarn).toBe(false);
    expect(result.shouldBlock).toBe(false);
  });

  it("returns shouldWarn=true below warn threshold", () => {
    const result = evaluateContextWindowGuard({
      info: { tokens: 20_000, source: "model" },
    });
    expect(result.shouldWarn).toBe(true);
    expect(result.shouldBlock).toBe(false);
  });

  it("returns shouldBlock=true below hard min", () => {
    const result = evaluateContextWindowGuard({
      info: { tokens: 8_000, source: "model" },
    });
    expect(result.shouldWarn).toBe(true);
    expect(result.shouldBlock).toBe(true);
  });

  it("supports custom thresholds", () => {
    const result = evaluateContextWindowGuard({
      info: { tokens: 5_000, source: "model" },
      warnBelowTokens: 4_000,
      hardMinTokens: 2_000,
    });
    expect(result.shouldWarn).toBe(false);
    expect(result.shouldBlock).toBe(false);
  });

  it("exports expected constants", () => {
    expect(CONTEXT_WINDOW_HARD_MIN_TOKENS).toBe(16_000);
    expect(CONTEXT_WINDOW_WARN_BELOW_TOKENS).toBe(32_000);
  });
});
