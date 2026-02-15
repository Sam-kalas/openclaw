import { describe, expect, it, vi } from "vitest";
// === agent-limits.ts ===
import {
  DEFAULT_AGENT_MAX_CONCURRENT,
  DEFAULT_SUBAGENT_MAX_CONCURRENT,
  resolveAgentMaxConcurrent,
  resolveSubagentMaxConcurrent,
} from "./agent-limits.js";
// === cache-utils.ts ===
import { resolveCacheTtlMs, isCacheEnabled } from "./cache-utils.js";
// === config-paths.ts ===
import {
  parseConfigPath,
  setConfigValueAtPath,
  unsetConfigValueAtPath,
  getConfigValueAtPath,
} from "./config-paths.js";
// === env-vars.ts ===
import { collectConfigEnvVars } from "./env-vars.js";
// === merge-config.ts ===
import { mergeConfigSection } from "./merge-config.js";
// === merge-patch.ts ===
import { applyMergePatch } from "./merge-patch.js";
// === port-defaults.ts ===
import {
  DEFAULT_BRIDGE_PORT,
  DEFAULT_BROWSER_CONTROL_PORT,
  DEFAULT_CANVAS_HOST_PORT,
  deriveDefaultBridgePort,
  deriveDefaultBrowserControlPort,
  deriveDefaultCanvasHostPort,
  deriveDefaultBrowserCdpPortRange,
} from "./port-defaults.js";
// === version.ts ===
import { parseOpenClawVersion, compareOpenClawVersions } from "./version.js";

// ---------------------------------------------------------------------------
// mergeConfigSection
// ---------------------------------------------------------------------------
describe("mergeConfigSection", () => {
  it("merges patch onto base, overwriting matching keys", () => {
    const base = { a: 1, b: 2 } as Record<string, unknown>;
    const result = mergeConfigSection(base, { b: 99 });
    expect(result).toEqual({ a: 1, b: 99 });
  });

  it("returns patch keys when base is undefined", () => {
    const result = mergeConfigSection(undefined as any, { x: "hello" });
    expect(result).toEqual({ x: "hello" });
  });

  it("skips undefined values in patch", () => {
    const base = { a: 1, b: 2 } as Record<string, unknown>;
    const result = mergeConfigSection(base, { a: undefined as any, b: 42 });
    expect(result).toEqual({ a: 1, b: 42 });
  });

  it("deletes keys listed in unsetOnUndefined when patch value is undefined", () => {
    const base = { a: 1, b: 2, c: 3 } as Record<string, unknown>;
    const result = mergeConfigSection(
      base,
      { b: undefined as any },
      { unsetOnUndefined: ["b"] as any },
    );
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it("does not delete key if not in unsetOnUndefined", () => {
    const base = { a: 1, b: 2 } as Record<string, unknown>;
    const result = mergeConfigSection(
      base,
      { a: undefined as any },
      { unsetOnUndefined: ["b"] as any },
    );
    expect(result).toEqual({ a: 1, b: 2 });
  });
});

// ---------------------------------------------------------------------------
// applyMergePatch (RFC 7386-style)
// ---------------------------------------------------------------------------
describe("applyMergePatch", () => {
  it("overwrites scalar values", () => {
    expect(applyMergePatch({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("returns patch directly when patch is not a plain object", () => {
    expect(applyMergePatch({ a: 1 }, "hello")).toBe("hello");
    expect(applyMergePatch({ a: 1 }, 42)).toBe(42);
    expect(applyMergePatch({ a: 1 }, null)).toBe(null);
  });

  it("deletes keys set to null", () => {
    expect(applyMergePatch({ a: 1, b: 2 }, { b: null })).toEqual({ a: 1 });
  });

  it("deep merges nested objects", () => {
    const base = { x: { y: 1, z: 2 } };
    const patch = { x: { z: 99 } };
    expect(applyMergePatch(base, patch)).toEqual({ x: { y: 1, z: 99 } });
  });

  it("creates object from non-object base when patch is object", () => {
    expect(applyMergePatch("scalar", { key: "val" })).toEqual({ key: "val" });
  });

  it("adds new keys", () => {
    expect(applyMergePatch({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });
});

// ---------------------------------------------------------------------------
// agent-limits.ts
// ---------------------------------------------------------------------------
describe("resolveAgentMaxConcurrent", () => {
  it("returns default when config is undefined", () => {
    expect(resolveAgentMaxConcurrent()).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
  });

  it("returns default when agents.defaults.maxConcurrent is not set", () => {
    expect(resolveAgentMaxConcurrent({} as any)).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
  });

  it("returns configured value when valid", () => {
    const cfg = { agents: { defaults: { maxConcurrent: 10 } } } as any;
    expect(resolveAgentMaxConcurrent(cfg)).toBe(10);
  });

  it("floors fractional values", () => {
    const cfg = { agents: { defaults: { maxConcurrent: 3.7 } } } as any;
    expect(resolveAgentMaxConcurrent(cfg)).toBe(3);
  });

  it("clamps to minimum of 1", () => {
    const cfg = { agents: { defaults: { maxConcurrent: 0 } } } as any;
    expect(resolveAgentMaxConcurrent(cfg)).toBe(1);
  });

  it("returns default for NaN", () => {
    const cfg = { agents: { defaults: { maxConcurrent: NaN } } } as any;
    expect(resolveAgentMaxConcurrent(cfg)).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
  });

  it("returns default for Infinity", () => {
    const cfg = { agents: { defaults: { maxConcurrent: Infinity } } } as any;
    expect(resolveAgentMaxConcurrent(cfg)).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
  });
});

describe("resolveSubagentMaxConcurrent", () => {
  it("returns default when config is undefined", () => {
    expect(resolveSubagentMaxConcurrent()).toBe(DEFAULT_SUBAGENT_MAX_CONCURRENT);
  });

  it("returns configured value", () => {
    const cfg = { agents: { defaults: { subagents: { maxConcurrent: 16 } } } } as any;
    expect(resolveSubagentMaxConcurrent(cfg)).toBe(16);
  });

  it("clamps to minimum of 1", () => {
    const cfg = { agents: { defaults: { subagents: { maxConcurrent: -5 } } } } as any;
    expect(resolveSubagentMaxConcurrent(cfg)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// cache-utils.ts
// ---------------------------------------------------------------------------
describe("resolveCacheTtlMs", () => {
  it("returns default when envValue is undefined", () => {
    expect(resolveCacheTtlMs({ envValue: undefined, defaultTtlMs: 5000 })).toBe(5000);
  });

  it("returns default when envValue is empty string", () => {
    expect(resolveCacheTtlMs({ envValue: "", defaultTtlMs: 3000 })).toBe(3000);
  });

  it("parses valid numeric envValue", () => {
    expect(resolveCacheTtlMs({ envValue: "10000", defaultTtlMs: 3000 })).toBe(10000);
  });

  it("returns 0 when envValue is 0 (disabling cache)", () => {
    expect(resolveCacheTtlMs({ envValue: "0", defaultTtlMs: 3000 })).toBe(0);
  });

  it("returns default for non-numeric envValue", () => {
    expect(resolveCacheTtlMs({ envValue: "abc", defaultTtlMs: 5000 })).toBe(5000);
  });

  it("returns default for negative envValue", () => {
    expect(resolveCacheTtlMs({ envValue: "-100", defaultTtlMs: 5000 })).toBe(5000);
  });
});

describe("isCacheEnabled", () => {
  it("returns true for positive TTL", () => {
    expect(isCacheEnabled(5000)).toBe(true);
  });

  it("returns false for zero TTL", () => {
    expect(isCacheEnabled(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// collectConfigEnvVars
// ---------------------------------------------------------------------------
describe("collectConfigEnvVars", () => {
  it("returns empty object when config is undefined", () => {
    expect(collectConfigEnvVars(undefined)).toEqual({});
  });

  it("returns empty object when env block is absent", () => {
    expect(collectConfigEnvVars({} as any)).toEqual({});
  });

  it("collects vars from env.vars", () => {
    const cfg = { env: { vars: { FOO: "bar", BAZ: "qux" } } } as any;
    expect(collectConfigEnvVars(cfg)).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("skips falsy values in env.vars", () => {
    const cfg = { env: { vars: { FOO: "bar", EMPTY: "" } } } as any;
    expect(collectConfigEnvVars(cfg)).toEqual({ FOO: "bar" });
  });

  it("collects top-level string entries in env (excluding shellEnv and vars)", () => {
    const cfg = { env: { MY_KEY: "value", shellEnv: "skip", vars: {} } } as any;
    expect(collectConfigEnvVars(cfg)).toEqual({ MY_KEY: "value" });
  });

  it("skips non-string and empty top-level values", () => {
    const cfg = { env: { NUM: 42, BLANK: "  ", VALID: "ok" } } as any;
    expect(collectConfigEnvVars(cfg)).toEqual({ VALID: "ok" });
  });
});

// ---------------------------------------------------------------------------
// port-defaults.ts
// ---------------------------------------------------------------------------
describe("port-defaults", () => {
  it("derives bridge port as gateway + 1", () => {
    expect(deriveDefaultBridgePort(18789)).toBe(18790);
  });

  it("derives browser control port as gateway + 2", () => {
    expect(deriveDefaultBrowserControlPort(18789)).toBe(18791);
  });

  it("derives canvas host port as gateway + 4", () => {
    expect(deriveDefaultCanvasHostPort(18789)).toBe(18793);
  });

  it("falls back to default when derived port exceeds 65535", () => {
    expect(deriveDefaultBridgePort(65535)).toBe(DEFAULT_BRIDGE_PORT);
  });

  it("falls back to default when derived port is invalid (> 65535)", () => {
    // -1 + 2 = 1 which is still a valid port; use NaN to trigger fallback
    expect(deriveDefaultBrowserControlPort(NaN)).toBe(DEFAULT_BROWSER_CONTROL_PORT);
  });

  it("derives browser CDP port range", () => {
    const range = deriveDefaultBrowserCdpPortRange(18791);
    expect(range.start).toBe(18800);
    expect(range.end).toBeGreaterThanOrEqual(range.start);
  });

  it("clamps CDP range when start exceeds 65535", () => {
    const range = deriveDefaultBrowserCdpPortRange(65530);
    // Should fall back to defaults
    expect(range.start).toBeGreaterThan(0);
    expect(range.end).toBeGreaterThanOrEqual(range.start);
  });
});

// ---------------------------------------------------------------------------
// version.ts
// ---------------------------------------------------------------------------
describe("parseOpenClawVersion", () => {
  it("parses standard version string", () => {
    expect(parseOpenClawVersion("2026.2.13")).toEqual({
      major: 2026,
      minor: 2,
      patch: 13,
      revision: 0,
    });
  });

  it("parses version with v prefix", () => {
    expect(parseOpenClawVersion("v1.2.3")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      revision: 0,
    });
  });

  it("parses version with revision", () => {
    expect(parseOpenClawVersion("v1.2.3-4")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      revision: 4,
    });
  });

  it("returns null for null/undefined/empty input", () => {
    expect(parseOpenClawVersion(null)).toBeNull();
    expect(parseOpenClawVersion(undefined)).toBeNull();
    expect(parseOpenClawVersion("")).toBeNull();
  });

  it("returns null for invalid version string", () => {
    expect(parseOpenClawVersion("not-a-version")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(parseOpenClawVersion("  1.0.0  ")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      revision: 0,
    });
  });
});

describe("compareOpenClawVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareOpenClawVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("compares by major version", () => {
    expect(compareOpenClawVersions("1.0.0", "2.0.0")).toBe(-1);
    expect(compareOpenClawVersions("2.0.0", "1.0.0")).toBe(1);
  });

  it("compares by minor version", () => {
    expect(compareOpenClawVersions("1.1.0", "1.2.0")).toBe(-1);
    expect(compareOpenClawVersions("1.3.0", "1.2.0")).toBe(1);
  });

  it("compares by patch version", () => {
    expect(compareOpenClawVersions("1.0.1", "1.0.2")).toBe(-1);
  });

  it("compares by revision", () => {
    expect(compareOpenClawVersions("1.0.0-1", "1.0.0-2")).toBe(-1);
    expect(compareOpenClawVersions("1.0.0-2", "1.0.0-1")).toBe(1);
  });

  it("returns null when either version is invalid", () => {
    expect(compareOpenClawVersions(null, "1.0.0")).toBeNull();
    expect(compareOpenClawVersions("1.0.0", null)).toBeNull();
    expect(compareOpenClawVersions("bad", "1.0.0")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// config-paths.ts
// ---------------------------------------------------------------------------
describe("parseConfigPath", () => {
  it("parses valid dot-notation path", () => {
    const result = parseConfigPath("foo.bar.baz");
    expect(result.ok).toBe(true);
    expect(result.path).toEqual(["foo", "bar", "baz"]);
  });

  it("rejects empty string", () => {
    const result = parseConfigPath("");
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects paths with empty segments (double dot)", () => {
    const result = parseConfigPath("foo..bar");
    expect(result.ok).toBe(false);
  });

  it("rejects __proto__ segment", () => {
    const result = parseConfigPath("__proto__.polluted");
    expect(result.ok).toBe(false);
  });

  it("rejects constructor segment", () => {
    const result = parseConfigPath("constructor.polluted");
    expect(result.ok).toBe(false);
  });

  it("rejects prototype segment", () => {
    const result = parseConfigPath("prototype.polluted");
    expect(result.ok).toBe(false);
  });

  it("trims whitespace around segments", () => {
    const result = parseConfigPath(" foo . bar ");
    expect(result.ok).toBe(true);
    expect(result.path).toEqual(["foo", "bar"]);
  });
});

describe("setConfigValueAtPath", () => {
  it("sets a value at a nested path, creating intermediate objects", () => {
    const root: Record<string, unknown> = {};
    setConfigValueAtPath(root, ["a", "b", "c"], 42);
    expect((root as any).a.b.c).toBe(42);
  });

  it("overwrites existing scalar with object path", () => {
    const root: Record<string, unknown> = { a: "scalar" };
    setConfigValueAtPath(root, ["a", "b"], "value");
    expect((root as any).a.b).toBe("value");
  });
});

describe("unsetConfigValueAtPath", () => {
  it("removes a leaf value and prunes empty parents", () => {
    const root: Record<string, unknown> = { a: { b: { c: 1 } } };
    const removed = unsetConfigValueAtPath(root, ["a", "b", "c"]);
    expect(removed).toBe(true);
    expect(root.a).toBeUndefined();
  });

  it("returns false when path does not exist", () => {
    const root: Record<string, unknown> = { a: 1 };
    expect(unsetConfigValueAtPath(root, ["x", "y"])).toBe(false);
  });

  it("does not prune non-empty parents", () => {
    const root: Record<string, unknown> = { a: { b: 1, c: 2 } };
    const removed = unsetConfigValueAtPath(root, ["a", "b"]);
    expect(removed).toBe(true);
    expect((root as any).a.c).toBe(2);
  });
});

describe("getConfigValueAtPath", () => {
  it("retrieves a nested value", () => {
    const root = { a: { b: { c: "found" } } };
    expect(getConfigValueAtPath(root, ["a", "b", "c"])).toBe("found");
  });

  it("returns undefined for missing path", () => {
    const root = { a: 1 };
    expect(getConfigValueAtPath(root, ["a", "b"])).toBeUndefined();
  });

  it("returns the root-level value for single-element path", () => {
    const root = { key: "value" };
    expect(getConfigValueAtPath(root, ["key"])).toBe("value");
  });
});
