import { describe, expect, it } from "vitest";
import {
  normalizePluginsConfig,
  resolveEnableState,
  resolveMemorySlotDecision,
  applyTestPluginDefaults,
  isTestDefaultMemorySlotDisabled,
  BUNDLED_ENABLED_BY_DEFAULT,
} from "./config-state.js";

describe("normalizePluginsConfig", () => {
  it("returns enabled true when config is undefined", () => {
    const result = normalizePluginsConfig(undefined);
    expect(result.enabled).toBe(true);
  });

  it("returns enabled true when enabled not explicitly false", () => {
    const result = normalizePluginsConfig({});
    expect(result.enabled).toBe(true);
  });

  it("returns enabled false when explicitly disabled", () => {
    const result = normalizePluginsConfig({ enabled: false });
    expect(result.enabled).toBe(false);
  });

  it("normalizes allow list from non-array to empty", () => {
    const result = normalizePluginsConfig({ allow: "not-an-array" as unknown as string[] });
    expect(result.allow).toEqual([]);
  });

  it("trims and filters allow list entries", () => {
    const result = normalizePluginsConfig({
      allow: ["  foo  ", "", "bar", 42 as unknown as string],
    });
    expect(result.allow).toEqual(["foo", "bar"]);
  });

  it("normalizes deny list from non-array to empty", () => {
    const result = normalizePluginsConfig({ deny: null as unknown as string[] });
    expect(result.deny).toEqual([]);
  });

  it("trims and filters deny list entries", () => {
    const result = normalizePluginsConfig({ deny: ["  blocked  ", ""] });
    expect(result.deny).toEqual(["blocked"]);
  });

  it("normalizes load paths", () => {
    const result = normalizePluginsConfig({ load: { paths: [" /a ", "/b"] } });
    expect(result.loadPaths).toEqual(["/a", "/b"]);
  });

  it("returns empty loadPaths when load is undefined", () => {
    const result = normalizePluginsConfig({});
    expect(result.loadPaths).toEqual([]);
  });

  it("normalizes plugin entries from non-object to empty", () => {
    const result = normalizePluginsConfig({
      entries: "invalid" as unknown as Record<string, unknown>,
    });
    expect(result.entries).toEqual({});
  });

  it("normalizes plugin entries from array to empty", () => {
    const result = normalizePluginsConfig({ entries: [] as unknown as Record<string, unknown> });
    expect(result.entries).toEqual({});
  });

  it("normalizes plugin entries with valid entries", () => {
    const result = normalizePluginsConfig({
      entries: {
        "my-plugin": { enabled: true, config: { key: "value" } },
        "other-plugin": { enabled: false },
      },
    });
    expect(result.entries["my-plugin"]).toEqual({ enabled: true, config: { key: "value" } });
    expect(result.entries["other-plugin"]).toEqual({ enabled: false, config: undefined });
  });

  it("normalizes plugin entries with non-object value to empty object", () => {
    const result = normalizePluginsConfig({
      entries: { "my-plugin": "invalid" as unknown as { enabled?: boolean } },
    });
    expect(result.entries["my-plugin"]).toEqual({});
  });

  it("skips entries with empty keys", () => {
    const result = normalizePluginsConfig({
      entries: { "": { enabled: true }, "  ": { enabled: true }, valid: { enabled: true } },
    });
    expect(Object.keys(result.entries)).toEqual(["valid"]);
  });
});

describe("resolveEnableState", () => {
  const baseConfig = normalizePluginsConfig({});

  it("returns disabled when plugins are globally disabled", () => {
    const config = normalizePluginsConfig({ enabled: false });
    const result = resolveEnableState("my-plugin", "global", config);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("plugins disabled");
  });

  it("returns disabled when plugin is in denylist", () => {
    const config = normalizePluginsConfig({ deny: ["my-plugin"] });
    const result = resolveEnableState("my-plugin", "global", config);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("blocked by denylist");
  });

  it("returns disabled when allowlist exists and plugin not in it", () => {
    const config = normalizePluginsConfig({ allow: ["other-plugin"] });
    const result = resolveEnableState("my-plugin", "global", config);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("not in allowlist");
  });

  it("returns enabled when plugin is in allowlist", () => {
    const config = normalizePluginsConfig({ allow: ["my-plugin"] });
    const result = resolveEnableState("my-plugin", "global", config);
    expect(result.enabled).toBe(true);
  });

  it("returns enabled when plugin is the memory slot", () => {
    const config = normalizePluginsConfig({ slots: { memory: "my-plugin" } });
    const result = resolveEnableState("my-plugin", "global", config);
    expect(result.enabled).toBe(true);
  });

  it("returns enabled when entry has enabled=true", () => {
    const config = normalizePluginsConfig({
      entries: { "my-plugin": { enabled: true } },
    });
    const result = resolveEnableState("my-plugin", "global", config);
    expect(result.enabled).toBe(true);
  });

  it("returns disabled when entry has enabled=false", () => {
    const config = normalizePluginsConfig({
      entries: { "my-plugin": { enabled: false } },
    });
    const result = resolveEnableState("my-plugin", "global", config);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("disabled in config");
  });

  it("returns enabled for bundled plugin in default-enabled set", () => {
    for (const id of BUNDLED_ENABLED_BY_DEFAULT) {
      const result = resolveEnableState(id, "bundled", baseConfig);
      expect(result.enabled).toBe(true);
    }
  });

  it("returns disabled for bundled plugin not in default-enabled set", () => {
    const result = resolveEnableState("unknown-bundled", "bundled", baseConfig);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("bundled (disabled by default)");
  });

  it("returns enabled for non-bundled plugins by default", () => {
    const result = resolveEnableState("my-global-plugin", "global", baseConfig);
    expect(result.enabled).toBe(true);
  });

  it("returns enabled for workspace plugins by default", () => {
    const result = resolveEnableState("my-ws-plugin", "workspace", baseConfig);
    expect(result.enabled).toBe(true);
  });
});

describe("resolveMemorySlotDecision", () => {
  it("returns enabled for non-memory plugins", () => {
    const result = resolveMemorySlotDecision({
      id: "my-plugin",
      kind: undefined,
      slot: "memory-core",
      selectedId: null,
    });
    expect(result.enabled).toBe(true);
  });

  it("returns disabled when memory slot is null", () => {
    const result = resolveMemorySlotDecision({
      id: "memory-core",
      kind: "memory",
      slot: null,
      selectedId: null,
    });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("memory slot disabled");
  });

  it("returns enabled+selected when slot matches plugin id", () => {
    const result = resolveMemorySlotDecision({
      id: "memory-core",
      kind: "memory",
      slot: "memory-core",
      selectedId: null,
    });
    expect(result.enabled).toBe(true);
    expect(result.selected).toBe(true);
  });

  it("returns disabled when slot is set to different plugin", () => {
    const result = resolveMemorySlotDecision({
      id: "other-memory",
      kind: "memory",
      slot: "memory-core",
      selectedId: null,
    });
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain("memory-core");
  });

  it("returns disabled when slot already filled by another", () => {
    const result = resolveMemorySlotDecision({
      id: "other-memory",
      kind: "memory",
      slot: undefined,
      selectedId: "memory-core",
    });
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain("memory-core");
  });

  it("returns enabled+selected when no slot set and no selection yet", () => {
    const result = resolveMemorySlotDecision({
      id: "memory-core",
      kind: "memory",
      slot: undefined,
      selectedId: null,
    });
    expect(result.enabled).toBe(true);
    expect(result.selected).toBe(true);
  });
});

describe("applyTestPluginDefaults", () => {
  it("returns config unchanged when not in vitest", () => {
    const cfg = { plugins: { enabled: true } };
    const result = applyTestPluginDefaults(cfg, {});
    expect(result).toBe(cfg);
  });

  it("disables plugins when no explicit config in vitest", () => {
    const cfg = {};
    const result = applyTestPluginDefaults(cfg, { VITEST: "true" });
    expect(result.plugins?.enabled).toBe(false);
    expect(result.plugins?.slots?.memory).toBe("none");
  });

  it("keeps explicit config but disables memory in vitest", () => {
    const cfg = { plugins: { enabled: true } };
    const result = applyTestPluginDefaults(cfg, { VITEST: "true" });
    expect(result.plugins?.enabled).toBe(true);
    expect(result.plugins?.slots?.memory).toBe("none");
  });

  it("does not override explicit memory slot in vitest", () => {
    const cfg = { plugins: { enabled: true, slots: { memory: "custom" } } };
    const result = applyTestPluginDefaults(cfg, { VITEST: "true" });
    expect(result).toBe(cfg);
  });

  it("does not override explicit memory entry in vitest", () => {
    const cfg = { plugins: { enabled: true, entries: { "memory-core": { enabled: true } } } };
    const result = applyTestPluginDefaults(cfg, { VITEST: "true" });
    expect(result).toBe(cfg);
  });
});

describe("isTestDefaultMemorySlotDisabled", () => {
  it("returns false when not in vitest", () => {
    expect(isTestDefaultMemorySlotDisabled({}, {})).toBe(false);
  });

  it("returns true in vitest with no explicit memory config", () => {
    expect(isTestDefaultMemorySlotDisabled({}, { VITEST: "true" })).toBe(true);
  });

  it("returns false when explicit memory slot is set", () => {
    expect(
      isTestDefaultMemorySlotDisabled(
        { plugins: { slots: { memory: "custom" } } },
        { VITEST: "true" },
      ),
    ).toBe(false);
  });

  it("returns false when explicit memory entry is set", () => {
    expect(
      isTestDefaultMemorySlotDisabled(
        { plugins: { entries: { "memory-core": { enabled: true } } } },
        { VITEST: "true" },
      ),
    ).toBe(false);
  });
});
