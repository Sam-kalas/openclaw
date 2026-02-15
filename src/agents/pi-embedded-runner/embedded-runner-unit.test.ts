import { describe, expect, it, vi } from "vitest";
// ────────────────────────────────────────────────────────────────
// 1. utils.ts — mapThinkingLevel, describeUnknownError
// ────────────────────────────────────────────────────────────────
import { mapThinkingLevel, describeUnknownError } from "./utils.js";

describe("mapThinkingLevel", () => {
  it("returns 'off' when level is undefined", () => {
    expect(mapThinkingLevel(undefined)).toBe("off");
  });

  it("returns 'off' when level is empty string", () => {
    expect(mapThinkingLevel("" as never)).toBe("off");
  });

  it("passes through 'low'", () => {
    expect(mapThinkingLevel("low")).toBe("low");
  });

  it("passes through 'high'", () => {
    expect(mapThinkingLevel("high")).toBe("high");
  });

  it("passes through 'xhigh'", () => {
    expect(mapThinkingLevel("xhigh")).toBe("xhigh");
  });
});

describe("describeUnknownError", () => {
  it("returns Error.message for Error instances", () => {
    expect(describeUnknownError(new Error("test error"))).toBe("test error");
  });

  it("returns the string itself for string errors", () => {
    expect(describeUnknownError("string error")).toBe("string error");
  });

  it("JSON-stringifies objects", () => {
    expect(describeUnknownError({ code: 42 })).toBe('{"code":42}');
  });

  it("returns 'Unknown error' for null", () => {
    expect(describeUnknownError(null)).toBe("null");
  });

  it("returns 'Unknown error' for circular objects", () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(describeUnknownError(obj)).toBe("Unknown error");
  });
});

// ────────────────────────────────────────────────────────────────
// 2. cache-ttl.ts — isCacheTtlEligibleProvider, readLastCacheTtlTimestamp
// ────────────────────────────────────────────────────────────────
import {
  isCacheTtlEligibleProvider,
  readLastCacheTtlTimestamp,
  appendCacheTtlTimestamp,
  CACHE_TTL_CUSTOM_TYPE,
} from "./cache-ttl.js";

describe("isCacheTtlEligibleProvider", () => {
  it("returns true for anthropic provider", () => {
    expect(isCacheTtlEligibleProvider("anthropic", "claude-opus-4-5")).toBe(true);
  });

  it("returns true for openrouter with anthropic model", () => {
    expect(isCacheTtlEligibleProvider("openrouter", "anthropic/claude-3-haiku")).toBe(true);
  });

  it("returns false for openrouter with non-anthropic model", () => {
    expect(isCacheTtlEligibleProvider("openrouter", "openai/gpt-4")).toBe(false);
  });

  it("returns false for openai provider", () => {
    expect(isCacheTtlEligibleProvider("openai", "gpt-4")).toBe(false);
  });

  it("is case-insensitive for provider", () => {
    expect(isCacheTtlEligibleProvider("ANTHROPIC", "claude-opus-4-5")).toBe(true);
  });
});

describe("readLastCacheTtlTimestamp", () => {
  it("returns null for null sessionManager", () => {
    expect(readLastCacheTtlTimestamp(null)).toBeNull();
  });

  it("returns null for sessionManager without getEntries", () => {
    expect(readLastCacheTtlTimestamp({})).toBeNull();
  });

  it("returns null when no cache-ttl entries exist", () => {
    const sm = {
      getEntries: () => [{ type: "message", customType: undefined, data: undefined }],
    };
    expect(readLastCacheTtlTimestamp(sm)).toBeNull();
  });

  it("returns the timestamp from the last cache-ttl entry", () => {
    const ts = Date.now();
    const sm = {
      getEntries: () => [
        { type: "custom", customType: CACHE_TTL_CUSTOM_TYPE, data: { timestamp: ts - 1000 } },
        { type: "message", customType: undefined, data: undefined },
        { type: "custom", customType: CACHE_TTL_CUSTOM_TYPE, data: { timestamp: ts } },
      ],
    };
    expect(readLastCacheTtlTimestamp(sm)).toBe(ts);
  });

  it("returns null when getEntries throws", () => {
    const sm = {
      getEntries: () => {
        throw new Error("fail");
      },
    };
    expect(readLastCacheTtlTimestamp(sm)).toBeNull();
  });
});

describe("appendCacheTtlTimestamp", () => {
  it("calls appendCustomEntry with correct args", () => {
    const appendCustomEntry = vi.fn();
    const sm = { appendCustomEntry };
    const data = { timestamp: Date.now(), provider: "anthropic", modelId: "claude-3" };
    appendCacheTtlTimestamp(sm, data);
    expect(appendCustomEntry).toHaveBeenCalledWith(CACHE_TTL_CUSTOM_TYPE, data);
  });

  it("does nothing when appendCustomEntry is missing", () => {
    // Should not throw
    appendCacheTtlTimestamp({}, { timestamp: Date.now() });
  });

  it("swallows errors from appendCustomEntry", () => {
    const sm = {
      appendCustomEntry: () => {
        throw new Error("write fail");
      },
    };
    // Should not throw
    appendCacheTtlTimestamp(sm, { timestamp: Date.now() });
  });
});

// ────────────────────────────────────────────────────────────────
// 3. abort.ts — isRunnerAbortError
// ────────────────────────────────────────────────────────────────
import { isRunnerAbortError } from "./abort.js";

describe("isRunnerAbortError", () => {
  it("returns false for null", () => {
    expect(isRunnerAbortError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isRunnerAbortError(undefined)).toBe(false);
  });

  it("returns false for non-objects", () => {
    expect(isRunnerAbortError("error string")).toBe(false);
    expect(isRunnerAbortError(42)).toBe(false);
  });

  it("returns true for AbortError by name", () => {
    const err = new DOMException("The operation was aborted", "AbortError");
    expect(isRunnerAbortError(err)).toBe(true);
  });

  it("returns true for error with 'aborted' in message", () => {
    expect(isRunnerAbortError(new Error("Request was aborted by user"))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isRunnerAbortError(new Error("network failure"))).toBe(false);
  });

  it("returns true for plain object with name AbortError", () => {
    expect(isRunnerAbortError({ name: "AbortError" })).toBe(true);
  });
});

import type { AgentMessage } from "@mariozechner/pi-agent-core";
// ────────────────────────────────────────────────────────────────
// 4. history.ts — limitHistoryTurns, getHistoryLimitFromSessionKey
// ────────────────────────────────────────────────────────────────
import { limitHistoryTurns, getHistoryLimitFromSessionKey } from "./history.js";

function msg(role: string): AgentMessage {
  return { role } as AgentMessage;
}

describe("limitHistoryTurns", () => {
  it("returns all messages when limit is undefined", () => {
    const messages = [msg("user"), msg("assistant"), msg("user"), msg("assistant")];
    expect(limitHistoryTurns(messages, undefined)).toEqual(messages);
  });

  it("returns all messages when limit is 0", () => {
    const messages = [msg("user"), msg("assistant")];
    expect(limitHistoryTurns(messages, 0)).toEqual(messages);
  });

  it("returns all messages when limit is negative", () => {
    const messages = [msg("user"), msg("assistant")];
    expect(limitHistoryTurns(messages, -1)).toEqual(messages);
  });

  it("returns empty array for empty input", () => {
    expect(limitHistoryTurns([], 5)).toEqual([]);
  });

  it("limits to last N user turns", () => {
    const messages = [
      msg("user"), // turn 1
      msg("assistant"),
      msg("user"), // turn 2
      msg("assistant"),
      msg("user"), // turn 3
      msg("assistant"),
    ];
    const result = limitHistoryTurns(messages, 2);
    expect(result).toHaveLength(4); // last 2 user turns + their assistants
    expect(result[0].role).toBe("user"); // turn 2
  });

  it("returns all messages when fewer turns than limit", () => {
    const messages = [msg("user"), msg("assistant")];
    expect(limitHistoryTurns(messages, 10)).toEqual(messages);
  });
});

describe("getHistoryLimitFromSessionKey (alias: getDmHistoryLimitFromSessionKey)", () => {
  it("returns undefined for undefined sessionKey", () => {
    expect(getHistoryLimitFromSessionKey(undefined, {})).toBeUndefined();
  });

  it("returns undefined for undefined config", () => {
    expect(getHistoryLimitFromSessionKey("telegram:dm:123", undefined)).toBeUndefined();
  });

  it("returns dmHistoryLimit for DM sessions", () => {
    const config = {
      channels: {
        telegram: { dmHistoryLimit: 50 },
      },
    };
    expect(getHistoryLimitFromSessionKey("telegram:dm:123", config)).toBe(50);
  });

  it("returns per-user DM override when available", () => {
    const config = {
      channels: {
        telegram: {
          dmHistoryLimit: 50,
          dms: { "123": { historyLimit: 10 } },
        },
      },
    };
    expect(getHistoryLimitFromSessionKey("telegram:dm:123", config)).toBe(10);
  });

  it("returns historyLimit for channel sessions", () => {
    const config = {
      channels: {
        discord: { historyLimit: 100 },
      },
    };
    expect(getHistoryLimitFromSessionKey("discord:channel:general", config)).toBe(100);
  });

  it("returns undefined when provider not in config", () => {
    expect(getHistoryLimitFromSessionKey("slack:dm:123", { channels: {} })).toBeUndefined();
  });

  it("strips thread suffix from session key user ID", () => {
    const config = {
      channels: {
        telegram: {
          dms: { "123": { historyLimit: 20 } },
        },
      },
    };
    expect(getHistoryLimitFromSessionKey("telegram:dm:123:thread:456", config)).toBe(20);
  });

  it("supports agent: prefixed session keys", () => {
    const config = {
      channels: {
        telegram: { dmHistoryLimit: 30 },
      },
    };
    expect(getHistoryLimitFromSessionKey("agent:main:telegram:dm:789", config)).toBe(30);
  });
});

// ────────────────────────────────────────────────────────────────
// 5. sandbox-info.ts — buildEmbeddedSandboxInfo
// ────────────────────────────────────────────────────────────────
import { buildEmbeddedSandboxInfo } from "./sandbox-info.js";

describe("buildEmbeddedSandboxInfo", () => {
  it("returns undefined when sandbox is not enabled", () => {
    expect(buildEmbeddedSandboxInfo(undefined)).toBeUndefined();
    expect(buildEmbeddedSandboxInfo({ enabled: false } as never)).toBeUndefined();
  });

  it("returns sandbox info for enabled sandbox", () => {
    const sandbox = {
      enabled: true,
      workspaceDir: "/workspace",
      workspaceAccess: "rw" as const,
      browser: { bridgeUrl: "http://localhost:3000", noVncUrl: "http://localhost:6080" },
      browserAllowHostControl: true,
    };
    const result = buildEmbeddedSandboxInfo(sandbox);
    expect(result).toEqual({
      enabled: true,
      workspaceDir: "/workspace",
      workspaceAccess: "rw",
      agentWorkspaceMount: undefined,
      browserBridgeUrl: "http://localhost:3000",
      browserNoVncUrl: "http://localhost:6080",
      hostBrowserAllowed: true,
    });
  });

  it("sets agentWorkspaceMount for read-only sandbox", () => {
    const sandbox = {
      enabled: true,
      workspaceDir: "/workspace",
      workspaceAccess: "ro" as const,
    };
    const result = buildEmbeddedSandboxInfo(sandbox);
    expect(result?.agentWorkspaceMount).toBe("/agent");
  });

  it("includes elevated info when exec elevated is allowed", () => {
    const sandbox = {
      enabled: true,
      workspaceDir: "/workspace",
      workspaceAccess: "rw" as const,
    };
    const execElevated = { enabled: true, allowed: true, defaultLevel: "ask" as const };
    const result = buildEmbeddedSandboxInfo(sandbox, execElevated);
    expect(result?.elevated).toEqual({ allowed: true, defaultLevel: "ask" });
  });

  it("omits elevated info when exec elevated is not allowed", () => {
    const sandbox = {
      enabled: true,
      workspaceDir: "/workspace",
      workspaceAccess: "rw" as const,
    };
    const execElevated = { enabled: false, allowed: false, defaultLevel: "off" as const };
    const result = buildEmbeddedSandboxInfo(sandbox, execElevated);
    expect(result?.elevated).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────
// 6. extra-params.ts — resolveExtraParams
// ────────────────────────────────────────────────────────────────
import { resolveExtraParams } from "./extra-params.js";

describe("resolveExtraParams", () => {
  it("returns undefined when no model config exists", () => {
    expect(resolveExtraParams({ cfg: {}, provider: "openai", modelId: "gpt-4" })).toBeUndefined();
  });

  it("returns params from model config", () => {
    const cfg = {
      agents: {
        defaults: {
          models: {
            "openai/gpt-4": {
              params: { temperature: 0.7, maxTokens: 1024 },
            },
          },
        },
      },
    };
    const result = resolveExtraParams({ cfg, provider: "openai", modelId: "gpt-4" });
    expect(result).toEqual({ temperature: 0.7, maxTokens: 1024 });
  });

  it("returns a copy of params (not a reference)", () => {
    const params = { temperature: 0.5 };
    const cfg = {
      agents: {
        defaults: {
          models: {
            "anthropic/claude-3": { params },
          },
        },
      },
    };
    const result = resolveExtraParams({ cfg, provider: "anthropic", modelId: "claude-3" });
    expect(result).toEqual(params);
    expect(result).not.toBe(params);
  });
});
