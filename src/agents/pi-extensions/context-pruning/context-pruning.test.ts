import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";
import type { EffectiveContextPruningSettings } from "./settings.js";
import {
  computeEffectiveSettings,
  DEFAULT_CONTEXT_PRUNING_SETTINGS,
  pruneContextMessages,
} from "../context-pruning.js";
import contextPruningExtension from "./extension.js";
import { getContextPruningRuntime, setContextPruningRuntime } from "./runtime.js";
import { makeToolPrunablePredicate } from "./tools.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeToolResult(params: {
  toolCallId: string;
  toolName: string;
  text: string;
}): AgentMessage {
  return {
    role: "toolResult",
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    content: [{ type: "text", text: params.text }],
    isError: false,
    timestamp: Date.now(),
  };
}

function makeImageToolResult(params: {
  toolCallId: string;
  toolName: string;
  text: string;
}): AgentMessage {
  return {
    role: "toolResult",
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    content: [
      { type: "image", data: "AA==", mimeType: "image/png" },
      { type: "text", text: params.text },
    ],
    isError: false,
    timestamp: Date.now(),
  };
}

function makeAssistant(text: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-responses",
    provider: "openai",
    model: "fake",
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, total: 2 },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

function makeUser(text: string): AgentMessage {
  return { role: "user", content: text, timestamp: Date.now() };
}

function toolText(msg: AgentMessage): string {
  if (msg.role !== "toolResult") {
    throw new Error("expected toolResult");
  }
  const first = msg.content.find((b: { type: string }) => b.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  return first?.text ?? "";
}

function findToolResult(messages: AgentMessage[], toolCallId: string): AgentMessage {
  const msg = messages.find((m) => m.role === "toolResult" && m.toolCallId === toolCallId);
  if (!msg) {
    throw new Error(`missing toolResult: ${toolCallId}`);
  }
  return msg;
}

function fakeCtx(contextWindow?: number): ExtensionContext {
  return {
    model: contextWindow != null ? { contextWindow } : undefined,
  } as unknown as ExtensionContext;
}

function baseSettings(
  overrides?: Partial<EffectiveContextPruningSettings>,
): EffectiveContextPruningSettings {
  return {
    ...DEFAULT_CONTEXT_PRUNING_SETTINGS,
    keepLastAssistants: 0,
    softTrimRatio: 0.0,
    hardClearRatio: 0.0,
    minPrunableToolChars: 0,
    hardClear: { enabled: true, placeholder: "[cleared]" },
    softTrim: { maxChars: 10, headChars: 3, tailChars: 3 },
    ...overrides,
  };
}

// ─── Tests: computeEffectiveSettings (settings.ts) ──────────────────────────

describe("computeEffectiveSettings", () => {
  it("returns null for undefined input", () => {
    expect(computeEffectiveSettings(undefined)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(computeEffectiveSettings(null)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(computeEffectiveSettings("string")).toBeNull();
    expect(computeEffectiveSettings(42)).toBeNull();
    expect(computeEffectiveSettings(true)).toBeNull();
  });

  it("returns null for empty object (mode defaults to off)", () => {
    expect(computeEffectiveSettings({})).toBeNull();
  });

  it("returns null for mode 'off'", () => {
    expect(computeEffectiveSettings({ mode: "off" })).toBeNull();
  });

  it("returns defaults for mode 'cache-ttl' with no overrides", () => {
    const result = computeEffectiveSettings({ mode: "cache-ttl" });
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("cache-ttl");
    expect(result!.ttlMs).toBe(DEFAULT_CONTEXT_PRUNING_SETTINGS.ttlMs);
    expect(result!.keepLastAssistants).toBe(DEFAULT_CONTEXT_PRUNING_SETTINGS.keepLastAssistants);
    expect(result!.softTrimRatio).toBe(DEFAULT_CONTEXT_PRUNING_SETTINGS.softTrimRatio);
    expect(result!.hardClearRatio).toBe(DEFAULT_CONTEXT_PRUNING_SETTINGS.hardClearRatio);
    expect(result!.minPrunableToolChars).toBe(
      DEFAULT_CONTEXT_PRUNING_SETTINGS.minPrunableToolChars,
    );
  });

  it("parses TTL duration strings", () => {
    const result = computeEffectiveSettings({
      mode: "cache-ttl",
      ttl: "10m",
    });
    expect(result!.ttlMs).toBe(600_000);
  });

  it("parses TTL with default unit minutes when no suffix", () => {
    const result = computeEffectiveSettings({ mode: "cache-ttl", ttl: "2" });
    expect(result!.ttlMs).toBe(120_000);
  });

  it("falls back to default TTL for invalid duration", () => {
    const result = computeEffectiveSettings({
      mode: "cache-ttl",
      ttl: "garbage",
    });
    expect(result!.ttlMs).toBe(DEFAULT_CONTEXT_PRUNING_SETTINGS.ttlMs);
  });

  it("clamps negative keepLastAssistants to 0", () => {
    const result = computeEffectiveSettings({
      mode: "cache-ttl",
      keepLastAssistants: -5,
    });
    expect(result!.keepLastAssistants).toBe(0);
  });

  it("floors keepLastAssistants to integer", () => {
    const result = computeEffectiveSettings({
      mode: "cache-ttl",
      keepLastAssistants: 2.9,
    });
    expect(result!.keepLastAssistants).toBe(2);
  });

  it("clamps softTrimRatio to [0, 1]", () => {
    const high = computeEffectiveSettings({
      mode: "cache-ttl",
      softTrimRatio: 5.0,
    });
    expect(high!.softTrimRatio).toBe(1.0);

    const low = computeEffectiveSettings({
      mode: "cache-ttl",
      softTrimRatio: -0.5,
    });
    expect(low!.softTrimRatio).toBe(0.0);
  });

  it("clamps hardClearRatio to [0, 1]", () => {
    const high = computeEffectiveSettings({
      mode: "cache-ttl",
      hardClearRatio: 2.0,
    });
    expect(high!.hardClearRatio).toBe(1.0);

    const low = computeEffectiveSettings({
      mode: "cache-ttl",
      hardClearRatio: -1,
    });
    expect(low!.hardClearRatio).toBe(0.0);
  });

  it("ignores NaN and Infinity for numeric fields", () => {
    const result = computeEffectiveSettings({
      mode: "cache-ttl",
      keepLastAssistants: NaN,
      softTrimRatio: Infinity,
      hardClearRatio: -Infinity,
      minPrunableToolChars: NaN,
    });
    // All should remain at defaults since isFinite returns false
    expect(result!.keepLastAssistants).toBe(DEFAULT_CONTEXT_PRUNING_SETTINGS.keepLastAssistants);
    expect(result!.softTrimRatio).toBe(DEFAULT_CONTEXT_PRUNING_SETTINGS.softTrimRatio);
    expect(result!.hardClearRatio).toBe(DEFAULT_CONTEXT_PRUNING_SETTINGS.hardClearRatio);
    expect(result!.minPrunableToolChars).toBe(
      DEFAULT_CONTEXT_PRUNING_SETTINGS.minPrunableToolChars,
    );
  });

  it("sets tools from config", () => {
    const result = computeEffectiveSettings({
      mode: "cache-ttl",
      tools: { allow: ["exec"], deny: ["read"] },
    });
    expect(result!.tools.allow).toEqual(["exec"]);
    expect(result!.tools.deny).toEqual(["read"]);
  });

  it("applies partial softTrim overrides", () => {
    const result = computeEffectiveSettings({
      mode: "cache-ttl",
      softTrim: { maxChars: 100 },
    });
    expect(result!.softTrim.maxChars).toBe(100);
    // headChars and tailChars stay at default
    expect(result!.softTrim.headChars).toBe(DEFAULT_CONTEXT_PRUNING_SETTINGS.softTrim.headChars);
    expect(result!.softTrim.tailChars).toBe(DEFAULT_CONTEXT_PRUNING_SETTINGS.softTrim.tailChars);
  });

  it("applies hardClear overrides", () => {
    const result = computeEffectiveSettings({
      mode: "cache-ttl",
      hardClear: { enabled: false, placeholder: "GONE" },
    });
    expect(result!.hardClear.enabled).toBe(false);
    expect(result!.hardClear.placeholder).toBe("GONE");
  });

  it("ignores empty/whitespace-only placeholder", () => {
    const result = computeEffectiveSettings({
      mode: "cache-ttl",
      hardClear: { placeholder: "   " },
    });
    expect(result!.hardClear.placeholder).toBe(
      DEFAULT_CONTEXT_PRUNING_SETTINGS.hardClear.placeholder,
    );
  });

  it("clamps negative minPrunableToolChars to 0", () => {
    const result = computeEffectiveSettings({
      mode: "cache-ttl",
      minPrunableToolChars: -100,
    });
    expect(result!.minPrunableToolChars).toBe(0);
  });
});

// ─── Tests: makeToolPrunablePredicate (tools.ts) ─────────────────────────────

describe("makeToolPrunablePredicate", () => {
  it("returns true for all tools when allow/deny are empty", () => {
    const pred = makeToolPrunablePredicate({});
    expect(pred("exec")).toBe(true);
    expect(pred("read")).toBe(true);
    expect(pred("anything")).toBe(true);
  });

  it("wildcard * in allow matches all tools", () => {
    const pred = makeToolPrunablePredicate({ allow: ["*"] });
    expect(pred("exec")).toBe(true);
    expect(pred("read")).toBe(true);
  });

  it("exact deny blocks specific tool", () => {
    const pred = makeToolPrunablePredicate({ deny: ["exec"] });
    expect(pred("exec")).toBe(false);
    expect(pred("read")).toBe(true);
  });

  it("deny wins over allow", () => {
    const pred = makeToolPrunablePredicate({
      allow: ["exec"],
      deny: ["exec"],
    });
    expect(pred("exec")).toBe(false);
  });

  it("is case-insensitive", () => {
    const pred = makeToolPrunablePredicate({ deny: ["EXEC"] });
    expect(pred("exec")).toBe(false);
    expect(pred("Exec")).toBe(false);
    expect(pred("EXEC")).toBe(false);
  });

  it("glob patterns work (e.g. 'web_*')", () => {
    const pred = makeToolPrunablePredicate({ allow: ["web_*"] });
    expect(pred("web_search")).toBe(true);
    expect(pred("web_fetch")).toBe(true);
    expect(pred("exec")).toBe(false);
  });

  it("non-matching allow returns false", () => {
    const pred = makeToolPrunablePredicate({ allow: ["exec"] });
    expect(pred("exec")).toBe(true);
    expect(pred("read")).toBe(false);
  });

  it("handles leading/trailing whitespace in patterns", () => {
    const pred = makeToolPrunablePredicate({ deny: ["  exec  "] });
    expect(pred("exec")).toBe(false);
  });

  it("filters out empty strings in patterns", () => {
    const pred = makeToolPrunablePredicate({ allow: ["", "exec", ""] });
    expect(pred("exec")).toBe(true);
    expect(pred("read")).toBe(false);
  });
});

// ─── Tests: runtime registry (runtime.ts) ───────────────────────────────────

describe("context-pruning runtime registry", () => {
  it("set and get works with object key", () => {
    const key = {};
    const value = {
      settings: DEFAULT_CONTEXT_PRUNING_SETTINGS,
      isToolPrunable: () => true,
    };
    setContextPruningRuntime(key, value);
    expect(getContextPruningRuntime(key)).toBe(value);
  });

  it("set null removes from registry", () => {
    const key = {};
    setContextPruningRuntime(key, {
      settings: DEFAULT_CONTEXT_PRUNING_SETTINGS,
      isToolPrunable: () => true,
    });
    setContextPruningRuntime(key, null);
    expect(getContextPruningRuntime(key)).toBeNull();
  });

  it("get with unknown key returns null", () => {
    expect(getContextPruningRuntime({})).toBeNull();
  });

  it("ignores null sessionManager on set", () => {
    // Should not throw
    setContextPruningRuntime(null, {
      settings: DEFAULT_CONTEXT_PRUNING_SETTINGS,
      isToolPrunable: () => true,
    });
  });

  it("ignores undefined sessionManager on set", () => {
    setContextPruningRuntime(undefined, {
      settings: DEFAULT_CONTEXT_PRUNING_SETTINGS,
      isToolPrunable: () => true,
    });
  });

  it("returns null for null sessionManager on get", () => {
    expect(getContextPruningRuntime(null)).toBeNull();
  });

  it("returns null for non-object sessionManager on get", () => {
    expect(getContextPruningRuntime("string")).toBeNull();
    expect(getContextPruningRuntime(42)).toBeNull();
  });

  it("different keys are independent", () => {
    const key1 = {};
    const key2 = {};
    const val1 = {
      settings: DEFAULT_CONTEXT_PRUNING_SETTINGS,
      isToolPrunable: () => true,
    };
    const val2 = {
      settings: { ...DEFAULT_CONTEXT_PRUNING_SETTINGS, keepLastAssistants: 99 },
      isToolPrunable: () => false,
    };
    setContextPruningRuntime(key1, val1);
    setContextPruningRuntime(key2, val2);
    expect(getContextPruningRuntime(key1)).toBe(val1);
    expect(getContextPruningRuntime(key2)).toBe(val2);
  });
});

// ─── Tests: pruneContextMessages (pruner.ts) ─────────────────────────────────

describe("pruneContextMessages", () => {
  it("returns original messages when context window is 0", () => {
    const messages = [
      makeUser("u1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(10_000) }),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings(),
      ctx: fakeCtx(0),
    });
    expect(result).toBe(messages);
  });

  it("returns original messages when ctx.model is undefined and no override", () => {
    const messages = [
      makeUser("u1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(10_000) }),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings(),
      ctx: fakeCtx(undefined),
    });
    expect(result).toBe(messages);
  });

  it("uses contextWindowTokensOverride when ctx.model is missing", () => {
    const messages = [
      makeUser("u1"),
      makeAssistant("a1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
      makeAssistant("a2"),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings(),
      ctx: fakeCtx(undefined),
      contextWindowTokensOverride: 1000,
    });
    expect(toolText(findToolResult(result, "t1"))).toBe("[cleared]");
  });

  it("returns original when ratio is below softTrimRatio", () => {
    const messages = [
      makeUser("u1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "short" }),
    ];
    // softTrimRatio=0.3, context window is huge relative to content
    const result = pruneContextMessages({
      messages,
      settings: baseSettings({ softTrimRatio: 0.3 }),
      ctx: fakeCtx(1_000_000),
    });
    expect(result).toBe(messages);
  });

  it("hard-clears tool results with placeholder", () => {
    const messages = [
      makeUser("u1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
      makeAssistant("a1"),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings(),
      ctx: fakeCtx(1000),
    });
    expect(toolText(findToolResult(result, "t1"))).toBe("[cleared]");
  });

  it("respects keepLastAssistants — protects tool results in the tail", () => {
    const messages = [
      makeUser("u1"),
      makeAssistant("a1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
      makeUser("u2"),
      makeAssistant("a2"),
      makeToolResult({ toolCallId: "t2", toolName: "exec", text: "y".repeat(20_000) }),
      makeUser("u3"),
      makeAssistant("a3"),
      makeToolResult({ toolCallId: "t3", toolName: "exec", text: "z".repeat(20_000) }),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings({ keepLastAssistants: 2 }),
      ctx: fakeCtx(1000),
    });
    // t1 is before the cutoff (only 2 assistants kept) → cleared
    expect(toolText(findToolResult(result, "t1"))).toBe("[cleared]");
    // t2, t3 are in the protected tail
    expect(toolText(findToolResult(result, "t2"))).toContain("y".repeat(20_000));
    expect(toolText(findToolResult(result, "t3"))).toContain("z".repeat(20_000));
  });

  it("returns null cutoff (no pruning) when not enough assistants", () => {
    const messages = [
      makeUser("u1"),
      makeAssistant("a1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
    ];
    // keepLastAssistants=5 but only 1 assistant → can't establish protected tail
    const result = pruneContextMessages({
      messages,
      settings: baseSettings({ keepLastAssistants: 5 }),
      ctx: fakeCtx(1000),
    });
    expect(result).toBe(messages);
  });

  it("protects tool results before the first user message (bootstrap safety)", () => {
    const messages = [
      makeAssistant("bootstrap"),
      makeToolResult({ toolCallId: "t0", toolName: "read", text: "x".repeat(20_000) }),
      makeAssistant("greeting"),
      makeUser("u1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "y".repeat(20_000) }),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings(),
      ctx: fakeCtx(1000),
      isToolPrunable: () => true,
      contextWindowTokensOverride: 1000,
    });
    // t0 is before first user → protected
    expect(toolText(findToolResult(result, "t0"))).toBe("x".repeat(20_000));
    // t1 is after first user → pruned
    expect(toolText(findToolResult(result, "t1"))).toBe("[cleared]");
  });

  it("skips tool results containing images", () => {
    const messages = [
      makeUser("u1"),
      makeImageToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings(),
      ctx: fakeCtx(1000),
    });
    const tool = findToolResult(result, "t1");
    if (tool.role !== "toolResult") {
      throw new Error("unexpected");
    }
    expect(tool.content.some((b: { type: string }) => b.type === "image")).toBe(true);
    expect(toolText(tool)).toContain("x".repeat(20_000));
  });

  it("respects minPrunableToolChars threshold — skips hard-clear when prunable chars are below minimum", () => {
    const messages = [
      makeUser("u1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
      makeAssistant("a1"),
    ];
    // softTrimRatio is high so soft trim doesn't fire. hardClearRatio is 0 so hard clear
    // WOULD fire, but minPrunableToolChars is above total prunable chars → skips hard clear.
    const result = pruneContextMessages({
      messages,
      settings: baseSettings({
        minPrunableToolChars: 1_000_000, // way above the 20k chars
        hardClearRatio: 0.0,
        softTrimRatio: 10.0, // very high → soft trim is skipped (ratio < softTrimRatio)
      }),
      ctx: fakeCtx(1_000_000), // large context window → ratio well below softTrimRatio
    });
    // Should NOT be cleared because total prunable chars < minPrunableToolChars
    expect(result).toBe(messages);
  });

  it("uses custom isToolPrunable callback", () => {
    const messages = [
      makeUser("u1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
      makeToolResult({ toolCallId: "t2", toolName: "read", text: "y".repeat(20_000) }),
      makeAssistant("a1"),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings(),
      ctx: fakeCtx(1000),
      // Only exec is prunable
      isToolPrunable: (name: string) => name === "exec",
    });
    expect(toolText(findToolResult(result, "t1"))).toBe("[cleared]");
    expect(toolText(findToolResult(result, "t2"))).toContain("y".repeat(20_000));
  });

  it("soft-trims oversized tool results preserving head/tail", () => {
    const messages = [
      makeUser("u1"),
      makeToolResult({
        toolCallId: "t1",
        toolName: "exec",
        text: "abcdefghij".repeat(1000),
      }),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings({
        softTrimRatio: 0.0,
        hardClearRatio: 10.0, // Very high → no hard clear
        softTrim: { maxChars: 10, headChars: 6, tailChars: 6 },
      }),
      ctx: fakeCtx(1000),
    });
    const text = toolText(findToolResult(result, "t1"));
    expect(text).toContain("abcdef");
    expect(text).toContain("efghij");
    expect(text).toContain("[Tool result trimmed:");
  });

  it("returns same reference when nothing changes", () => {
    const messages = [
      makeUser("u1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "small" }),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings({
        softTrimRatio: 0.0,
        hardClearRatio: 10.0,
        softTrim: { maxChars: 10_000, headChars: 1000, tailChars: 1000 },
      }),
      ctx: fakeCtx(1000),
    });
    // Tool result is small, below softTrim threshold, and ratio is high for hard clear
    expect(result).toBe(messages);
  });

  it("does not hard-clear when hardClear.enabled is false", () => {
    const messages = [
      makeUser("u1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
      makeAssistant("a1"),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings({
        hardClear: { enabled: false, placeholder: "[cleared]" },
        softTrimRatio: 10.0, // skip soft trim
      }),
      ctx: fakeCtx(1000),
    });
    // Hard clear disabled — even if ratio exceeds threshold, nothing is cleared
    // The soft-trim may have fired, but the content won't be replaced with placeholder
    expect(toolText(findToolResult(result, "t1"))).not.toBe("[cleared]");
  });

  it("handles empty messages array", () => {
    const result = pruneContextMessages({
      messages: [],
      settings: baseSettings(),
      ctx: fakeCtx(1000),
    });
    expect(result).toEqual([]);
  });

  it("prunes multiple tool results in order until ratio drops below threshold", () => {
    const messages = [
      makeUser("u1"),
      makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
      makeToolResult({ toolCallId: "t2", toolName: "exec", text: "y".repeat(20_000) }),
      makeToolResult({ toolCallId: "t3", toolName: "exec", text: "z".repeat(20_000) }),
      makeAssistant("a1"),
    ];
    const result = pruneContextMessages({
      messages,
      settings: baseSettings(),
      ctx: fakeCtx(1000),
    });
    // All three should be cleared since they're before the last assistant
    expect(toolText(findToolResult(result, "t1"))).toBe("[cleared]");
    expect(toolText(findToolResult(result, "t2"))).toBe("[cleared]");
    expect(toolText(findToolResult(result, "t3"))).toBe("[cleared]");
  });
});

// ─── Tests: extension wiring (extension.ts) ─────────────────────────────────

describe("contextPruningExtension", () => {
  it("registers a context handler", () => {
    let registered = false;
    const api = {
      on: (name: string, _fn: unknown) => {
        if (name === "context") {
          registered = true;
        }
      },
      appendEntry: () => {},
    } as unknown as ExtensionAPI;
    contextPruningExtension(api);
    expect(registered).toBe(true);
  });

  it("returns undefined when no runtime is registered", () => {
    let handler:
      | ((event: { messages: AgentMessage[] }, ctx: ExtensionContext) => unknown)
      | undefined;
    const api = {
      on: (name: string, fn: unknown) => {
        if (name === "context") {
          handler = fn as typeof handler;
        }
      },
      appendEntry: () => {},
    } as unknown as ExtensionAPI;

    contextPruningExtension(api);
    expect(handler).toBeDefined();

    const result = handler!({ messages: [] }, {
      sessionManager: {},
      model: undefined,
    } as unknown as ExtensionContext);
    expect(result).toBeUndefined();
  });

  it("skips pruning when TTL has not expired", () => {
    const sessionManager = {};
    setContextPruningRuntime(sessionManager, {
      settings: baseSettings(),
      contextWindowTokens: 1000,
      isToolPrunable: () => true,
      lastCacheTouchAt: Date.now(), // Just touched → TTL not expired
    });

    let handler:
      | ((event: { messages: AgentMessage[] }, ctx: ExtensionContext) => unknown)
      | undefined;
    const api = {
      on: (name: string, fn: unknown) => {
        if (name === "context") {
          handler = fn as typeof handler;
        }
      },
      appendEntry: () => {},
    } as unknown as ExtensionAPI;

    contextPruningExtension(api);
    const result = handler!(
      {
        messages: [
          makeUser("u1"),
          makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
        ],
      },
      { sessionManager, model: undefined } as unknown as ExtensionContext,
    );
    expect(result).toBeUndefined();
  });

  it("prunes when TTL has expired and updates lastCacheTouchAt", () => {
    const sessionManager = {};
    const expiredTime = Date.now() - DEFAULT_CONTEXT_PRUNING_SETTINGS.ttlMs - 1000;
    setContextPruningRuntime(sessionManager, {
      settings: baseSettings(),
      contextWindowTokens: 1000,
      isToolPrunable: () => true,
      lastCacheTouchAt: expiredTime,
    });

    let handler:
      | ((event: { messages: AgentMessage[] }, ctx: ExtensionContext) => unknown)
      | undefined;
    const api = {
      on: (name: string, fn: unknown) => {
        if (name === "context") {
          handler = fn as typeof handler;
        }
      },
      appendEntry: () => {},
    } as unknown as ExtensionAPI;

    contextPruningExtension(api);
    const result = handler!(
      {
        messages: [
          makeUser("u1"),
          makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
          makeAssistant("a1"),
        ],
      },
      { sessionManager, model: undefined } as unknown as ExtensionContext,
    ) as { messages: AgentMessage[] };

    expect(result).toBeDefined();
    expect(toolText(findToolResult(result.messages, "t1"))).toBe("[cleared]");

    // TTL should have been updated
    const runtime = getContextPruningRuntime(sessionManager);
    expect(runtime!.lastCacheTouchAt).toBeGreaterThan(expiredTime);
  });

  it("skips pruning when lastCacheTouchAt is null", () => {
    const sessionManager = {};
    setContextPruningRuntime(sessionManager, {
      settings: baseSettings(),
      contextWindowTokens: 1000,
      isToolPrunable: () => true,
      lastCacheTouchAt: null,
    });

    let handler:
      | ((event: { messages: AgentMessage[] }, ctx: ExtensionContext) => unknown)
      | undefined;
    const api = {
      on: (name: string, fn: unknown) => {
        if (name === "context") {
          handler = fn as typeof handler;
        }
      },
      appendEntry: () => {},
    } as unknown as ExtensionAPI;

    contextPruningExtension(api);
    const result = handler!(
      {
        messages: [
          makeUser("u1"),
          makeToolResult({ toolCallId: "t1", toolName: "exec", text: "x".repeat(20_000) }),
        ],
      },
      { sessionManager, model: undefined } as unknown as ExtensionContext,
    );
    expect(result).toBeUndefined();
  });
});
