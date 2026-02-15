import { describe, expect, it } from "vitest";
import { recordPluginInstall } from "./installs.js";

describe("recordPluginInstall", () => {
  it("records a new plugin install", () => {
    const result = recordPluginInstall(
      {},
      {
        pluginId: "my-plugin",
        source: "npm",
        spec: "my-plugin@1.0.0",
        installedAt: "2025-01-01T00:00:00Z",
      },
    );
    const install = result.plugins?.installs?.["my-plugin"];
    expect(install).toBeDefined();
    expect(install!.source).toBe("npm");
    expect(install!.spec).toBe("my-plugin@1.0.0");
    expect(install!.installedAt).toBe("2025-01-01T00:00:00Z");
  });

  it("preserves existing plugin installs", () => {
    const result = recordPluginInstall(
      {
        plugins: {
          installs: {
            "existing-plugin": {
              source: "npm",
              spec: "existing@1.0.0",
              installedAt: "2024-01-01T00:00:00Z",
            },
          },
        },
      },
      {
        pluginId: "new-plugin",
        source: "local",
        spec: "/path/to/plugin",
        installedAt: "2025-01-01T00:00:00Z",
      },
    );
    expect(result.plugins?.installs?.["existing-plugin"]).toBeDefined();
    expect(result.plugins?.installs?.["new-plugin"]).toBeDefined();
  });

  it("sets installedAt when not provided", () => {
    const result = recordPluginInstall(
      {},
      {
        pluginId: "my-plugin",
        source: "npm",
        spec: "my-plugin@1.0.0",
      },
    );
    const install = result.plugins?.installs?.["my-plugin"];
    expect(install!.installedAt).toBeDefined();
    // installedAt should be a valid ISO string
    expect(new Date(install!.installedAt!).toISOString()).toBe(install!.installedAt);
  });

  it("merges with existing install record", () => {
    const result = recordPluginInstall(
      {
        plugins: {
          installs: {
            "my-plugin": {
              source: "npm",
              spec: "my-plugin@1.0.0",
              installedAt: "2024-01-01T00:00:00Z",
            },
          },
        },
      },
      {
        pluginId: "my-plugin",
        source: "local",
        spec: "/new/path",
        installedAt: "2025-01-01T00:00:00Z",
      },
    );
    const install = result.plugins?.installs?.["my-plugin"];
    expect(install!.source).toBe("local");
    expect(install!.spec).toBe("/new/path");
    expect(install!.installedAt).toBe("2025-01-01T00:00:00Z");
  });
});
