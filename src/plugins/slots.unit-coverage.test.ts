import { describe, expect, it } from "vitest";
import { slotKeyForPluginKind, defaultSlotIdForKey, applyExclusiveSlotSelection } from "./slots.js";

describe("slotKeyForPluginKind", () => {
  it("returns 'memory' for kind 'memory'", () => {
    expect(slotKeyForPluginKind("memory")).toBe("memory");
  });

  it("returns null for undefined kind", () => {
    expect(slotKeyForPluginKind(undefined)).toBeNull();
  });

  it("returns null for unknown kind", () => {
    expect(slotKeyForPluginKind("unknown" as "memory")).toBeNull();
  });
});

describe("defaultSlotIdForKey", () => {
  it("returns 'memory-core' for 'memory' slot key", () => {
    expect(defaultSlotIdForKey("memory")).toBe("memory-core");
  });
});

describe("applyExclusiveSlotSelection", () => {
  it("returns unchanged config for non-slot plugin kind", () => {
    const config = {};
    const result = applyExclusiveSlotSelection({
      config,
      selectedId: "my-plugin",
      selectedKind: undefined,
    });
    expect(result.changed).toBe(false);
    expect(result.config).toBe(config);
    expect(result.warnings).toEqual([]);
  });

  it("sets memory slot for memory kind", () => {
    const result = applyExclusiveSlotSelection({
      config: {},
      selectedId: "custom-memory",
      selectedKind: "memory",
    });
    expect(result.changed).toBe(true);
    expect(result.config.plugins?.slots?.memory).toBe("custom-memory");
  });

  it("warns when switching from default slot", () => {
    const result = applyExclusiveSlotSelection({
      config: {},
      selectedId: "custom-memory",
      selectedKind: "memory",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("memory-core");
    expect(result.warnings[0]).toContain("custom-memory");
  });

  it("warns when switching from explicit previous slot", () => {
    const result = applyExclusiveSlotSelection({
      config: { plugins: { slots: { memory: "old-memory" } } },
      selectedId: "new-memory",
      selectedKind: "memory",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("old-memory");
  });

  it("does not change when already selected", () => {
    const config = { plugins: { slots: { memory: "memory-core" } } };
    const result = applyExclusiveSlotSelection({
      config,
      selectedId: "memory-core",
      selectedKind: "memory",
    });
    expect(result.changed).toBe(false);
  });

  it("disables competing memory plugins from registry", () => {
    const result = applyExclusiveSlotSelection({
      config: {},
      selectedId: "new-memory",
      selectedKind: "memory",
      registry: {
        plugins: [
          { id: "new-memory", kind: "memory" },
          { id: "old-memory", kind: "memory" },
          { id: "non-memory", kind: undefined },
        ],
      },
    });
    expect(result.changed).toBe(true);
    expect(result.config.plugins?.entries?.["old-memory"]?.enabled).toBe(false);
    expect(result.config.plugins?.entries?.["non-memory"]).toBeUndefined();
    expect(result.warnings.some((w) => w.includes("old-memory"))).toBe(true);
  });

  it("does not disable the selected plugin", () => {
    const result = applyExclusiveSlotSelection({
      config: {},
      selectedId: "new-memory",
      selectedKind: "memory",
      registry: {
        plugins: [{ id: "new-memory", kind: "memory" }],
      },
    });
    expect(result.config.plugins?.entries?.["new-memory"]).toBeUndefined();
  });
});
