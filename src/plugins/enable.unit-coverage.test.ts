import { describe, expect, it } from "vitest";
import { enablePluginInConfig } from "./enable.js";

describe("enablePluginInConfig", () => {
  it("returns disabled when plugins are globally disabled", () => {
    const result = enablePluginInConfig({ plugins: { enabled: false } }, "my-plugin");
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("plugins disabled");
    expect(result.config).toEqual({ plugins: { enabled: false } });
  });

  it("returns disabled when plugin is in denylist", () => {
    const result = enablePluginInConfig({ plugins: { deny: ["my-plugin"] } }, "my-plugin");
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("blocked by denylist");
  });

  it("enables plugin by setting entries enabled=true", () => {
    const result = enablePluginInConfig({}, "my-plugin");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.entries?.["my-plugin"]).toEqual({ enabled: true });
  });

  it("preserves existing entries when enabling", () => {
    const result = enablePluginInConfig(
      { plugins: { entries: { other: { enabled: true } } } },
      "my-plugin",
    );
    expect(result.config.plugins?.entries?.["other"]).toEqual({ enabled: true });
    expect(result.config.plugins?.entries?.["my-plugin"]).toEqual({ enabled: true });
  });

  it("adds plugin to allowlist when allowlist exists", () => {
    const result = enablePluginInConfig({ plugins: { allow: ["existing-plugin"] } }, "my-plugin");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.allow).toContain("my-plugin");
    expect(result.config.plugins?.allow).toContain("existing-plugin");
  });

  it("does not duplicate plugin in allowlist if already present", () => {
    const result = enablePluginInConfig({ plugins: { allow: ["my-plugin"] } }, "my-plugin");
    expect(result.enabled).toBe(true);
    const allowList = result.config.plugins?.allow ?? [];
    expect(allowList.filter((id) => id === "my-plugin")).toHaveLength(1);
  });

  it("preserves existing plugin entry config", () => {
    const result = enablePluginInConfig(
      {
        plugins: {
          entries: { "my-plugin": { config: { key: "value" } } as Record<string, unknown> },
        },
      },
      "my-plugin",
    );
    expect(result.config.plugins?.entries?.["my-plugin"]).toEqual({
      config: { key: "value" },
      enabled: true,
    });
  });
});
