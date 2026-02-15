import { describe, expect, it } from "vitest";
import {
  normalizeToolName,
  isOwnerOnlyToolName,
  normalizeToolList,
  expandToolGroups,
  collectExplicitAllowlist,
  resolveToolProfilePolicy,
  TOOL_GROUPS,
  buildPluginToolGroups,
  expandPluginGroups,
  expandPolicyWithPluginGroups,
  stripPluginOnlyAllowlist,
} from "./tool-policy.js";

describe("normalizeToolName", () => {
  it("lowercases and trims", () => {
    expect(normalizeToolName("  Read  ")).toBe("read");
  });

  it("resolves bash alias to exec", () => {
    expect(normalizeToolName("bash")).toBe("exec");
  });

  it("resolves apply-patch alias", () => {
    expect(normalizeToolName("apply-patch")).toBe("apply_patch");
  });

  it("passes through unknown names unchanged", () => {
    expect(normalizeToolName("web_search")).toBe("web_search");
  });
});

describe("isOwnerOnlyToolName", () => {
  it("returns true for whatsapp_login", () => {
    expect(isOwnerOnlyToolName("whatsapp_login")).toBe(true);
  });

  it("is case-insensitive via normalizeToolName", () => {
    expect(isOwnerOnlyToolName("WhatsApp_Login")).toBe(true);
  });

  it("returns false for regular tools", () => {
    expect(isOwnerOnlyToolName("read")).toBe(false);
    expect(isOwnerOnlyToolName("exec")).toBe(false);
    expect(isOwnerOnlyToolName("web_search")).toBe(false);
  });
});

describe("normalizeToolList", () => {
  it("normalizes and filters empty entries", () => {
    expect(normalizeToolList(["Read", "EXEC", ""])).toEqual(["read", "exec"]);
  });

  it("returns empty array for undefined", () => {
    expect(normalizeToolList(undefined)).toEqual([]);
  });

  it("resolves aliases", () => {
    expect(normalizeToolList(["bash", "apply-patch"])).toEqual(["exec", "apply_patch"]);
  });
});

describe("expandToolGroups", () => {
  it("expands group:web to web_search and web_fetch", () => {
    const result = expandToolGroups(["group:web"]);
    expect(result).toContain("web_search");
    expect(result).toContain("web_fetch");
  });

  it("expands group:fs to file tools", () => {
    const result = expandToolGroups(["group:fs"]);
    expect(result).toContain("read");
    expect(result).toContain("write");
    expect(result).toContain("edit");
    expect(result).toContain("apply_patch");
  });

  it("passes through non-group entries", () => {
    const result = expandToolGroups(["exec", "group:web"]);
    expect(result).toContain("exec");
    expect(result).toContain("web_search");
  });

  it("deduplicates results", () => {
    const result = expandToolGroups(["web_search", "group:web"]);
    const count = result.filter((t) => t === "web_search").length;
    expect(count).toBe(1);
  });

  it("handles undefined input", () => {
    expect(expandToolGroups(undefined)).toEqual([]);
  });

  it("expands group:runtime to exec and process", () => {
    const result = expandToolGroups(["group:runtime"]);
    expect(result).toEqual(["exec", "process"]);
  });

  it("expands group:memory", () => {
    const result = expandToolGroups(["group:memory"]);
    expect(result).toContain("memory_search");
    expect(result).toContain("memory_get");
  });
});

describe("collectExplicitAllowlist", () => {
  it("collects allow entries from multiple policies", () => {
    const result = collectExplicitAllowlist([{ allow: ["read", "write"] }, { allow: ["exec"] }]);
    expect(result).toEqual(["read", "write", "exec"]);
  });

  it("skips undefined policies and policies without allow", () => {
    const result = collectExplicitAllowlist([undefined, { deny: ["exec"] }, { allow: ["read"] }]);
    expect(result).toEqual(["read"]);
  });

  it("trims and filters non-string entries", () => {
    const result = collectExplicitAllowlist([{ allow: ["  read  ", "", 42 as any] }]);
    expect(result).toEqual(["read"]);
  });
});

describe("resolveToolProfilePolicy", () => {
  it("returns undefined for unknown profile", () => {
    expect(resolveToolProfilePolicy("nonexistent")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(resolveToolProfilePolicy(undefined)).toBeUndefined();
  });

  it("returns allow list for minimal profile", () => {
    const result = resolveToolProfilePolicy("minimal");
    expect(result).toBeDefined();
    expect(result!.allow).toContain("session_status");
  });

  it("returns allow list for coding profile", () => {
    const result = resolveToolProfilePolicy("coding");
    expect(result).toBeDefined();
    expect(result!.allow).toContain("group:fs");
    expect(result!.allow).toContain("group:runtime");
  });

  it("returns undefined for full profile (no restrictions)", () => {
    expect(resolveToolProfilePolicy("full")).toBeUndefined();
  });

  it("returns a copy of the policy (not the original reference)", () => {
    const a = resolveToolProfilePolicy("minimal");
    const b = resolveToolProfilePolicy("minimal");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe("TOOL_GROUPS", () => {
  it("has expected groups defined", () => {
    expect(TOOL_GROUPS).toHaveProperty("group:web");
    expect(TOOL_GROUPS).toHaveProperty("group:fs");
    expect(TOOL_GROUPS).toHaveProperty("group:runtime");
    expect(TOOL_GROUPS).toHaveProperty("group:sessions");
    expect(TOOL_GROUPS).toHaveProperty("group:openclaw");
  });

  it("group:openclaw contains core tools", () => {
    const openclaw = TOOL_GROUPS["group:openclaw"];
    expect(openclaw).toContain("browser");
    expect(openclaw).toContain("web_search");
    expect(openclaw).toContain("sessions_spawn");
  });
});

describe("buildPluginToolGroups", () => {
  it("groups tools by plugin id", () => {
    const tools = [
      { name: "plugin_a_read" },
      { name: "plugin_a_write" },
      { name: "plugin_b_search" },
      { name: "core_tool" },
    ];
    const result = buildPluginToolGroups({
      tools,
      toolMeta: (tool) => {
        if (tool.name.startsWith("plugin_a")) {
          return { pluginId: "plugin-a" };
        }
        if (tool.name.startsWith("plugin_b")) {
          return { pluginId: "plugin-b" };
        }
        return undefined;
      },
    });
    expect(result.all).toEqual(["plugin_a_read", "plugin_a_write", "plugin_b_search"]);
    expect(result.byPlugin.get("plugin-a")).toEqual(["plugin_a_read", "plugin_a_write"]);
    expect(result.byPlugin.get("plugin-b")).toEqual(["plugin_b_search"]);
  });

  it("returns empty groups when no plugin tools", () => {
    const result = buildPluginToolGroups({
      tools: [{ name: "read" }],
      toolMeta: () => undefined,
    });
    expect(result.all).toEqual([]);
    expect(result.byPlugin.size).toBe(0);
  });
});

describe("expandPluginGroups", () => {
  const groups = {
    all: ["p_read", "p_write", "q_search"],
    byPlugin: new Map([
      ["myplugin", ["p_read", "p_write"]],
      ["other", ["q_search"]],
    ]),
  };

  it("expands group:plugins to all plugin tools", () => {
    const result = expandPluginGroups(["group:plugins"], groups);
    expect(result).toContain("p_read");
    expect(result).toContain("p_write");
    expect(result).toContain("q_search");
  });

  it("expands plugin id to its tools", () => {
    const result = expandPluginGroups(["myplugin"], groups);
    expect(result).toEqual(["p_read", "p_write"]);
  });

  it("passes through non-plugin entries", () => {
    const result = expandPluginGroups(["exec", "myplugin"], groups);
    expect(result).toContain("exec");
    expect(result).toContain("p_read");
  });

  it("returns undefined/empty for undefined input", () => {
    expect(expandPluginGroups(undefined, groups)).toBeUndefined();
    expect(expandPluginGroups([], groups)).toEqual([]);
  });
});
