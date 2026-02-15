import type { AgentTool } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { buildToolSummaryMap } from "./tool-summaries.js";

function tool(overrides: Partial<AgentTool> & { name: string }): AgentTool {
  return { execute: () => Promise.resolve(""), ...overrides } as unknown as AgentTool;
}

describe("buildToolSummaryMap", () => {
  it("builds map from tool descriptions", () => {
    const tools = [
      tool({ name: "Read", description: "Read a file", label: "File Reader" }),
      tool({ name: "Write", description: "Write a file", label: "File Writer" }),
    ];
    const result = buildToolSummaryMap(tools);
    expect(result.read).toBe("Read a file");
    expect(result.write).toBe("Write a file");
  });

  it("lowercases tool names", () => {
    const tools = [tool({ name: "MyTool", description: "Does stuff" })];
    const result = buildToolSummaryMap(tools);
    expect(result.mytool).toBe("Does stuff");
  });

  it("falls back to label when description is empty", () => {
    const tools = [tool({ name: "Tool", description: "", label: "My Label" })];
    const result = buildToolSummaryMap(tools);
    expect(result.tool).toBe("My Label");
  });

  it("skips tools with no description or label", () => {
    const tools = [tool({ name: "Empty" })];
    const result = buildToolSummaryMap(tools);
    expect(result.empty).toBeUndefined();
  });

  it("returns empty map for empty tools array", () => {
    expect(buildToolSummaryMap([])).toEqual({});
  });
});
