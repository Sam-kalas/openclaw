import { afterEach, describe, expect, it } from "vitest";
import {
  validateCommandName,
  registerPluginCommand,
  matchPluginCommand,
  clearPluginCommands,
  listPluginCommands,
  getPluginCommandSpecs,
  clearPluginCommandsForPlugin,
  executePluginCommand,
} from "./commands.js";

afterEach(() => {
  clearPluginCommands();
});

describe("validateCommandName", () => {
  it("rejects empty name", () => {
    expect(validateCommandName("")).toBe("Command name cannot be empty");
  });

  it("rejects whitespace-only name", () => {
    expect(validateCommandName("   ")).toBe("Command name cannot be empty");
  });

  it("rejects name starting with number", () => {
    const result = validateCommandName("1abc");
    expect(result).toContain("must start with a letter");
  });

  it("rejects name with special characters", () => {
    const result = validateCommandName("my!command");
    expect(result).toContain("must start with a letter");
  });

  it("rejects reserved command names", () => {
    const result = validateCommandName("help");
    expect(result).toContain("reserved");
  });

  it("rejects reserved command case-insensitively", () => {
    const result = validateCommandName("HELP");
    expect(result).toContain("reserved");
  });

  it("accepts valid command name", () => {
    expect(validateCommandName("my-command")).toBeNull();
  });

  it("accepts command with underscores", () => {
    expect(validateCommandName("my_command")).toBeNull();
  });

  it("accepts command with numbers after first letter", () => {
    expect(validateCommandName("cmd123")).toBeNull();
  });

  it("trims and lowercases before validation", () => {
    expect(validateCommandName("  MyCommand  ")).toBeNull();
  });
});

describe("registerPluginCommand", () => {
  it("registers a valid command successfully", () => {
    const result = registerPluginCommand("test-plugin", {
      name: "greet",
      description: "Say hello",
      handler: async () => ({ text: "Hello!" }),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate registration", () => {
    registerPluginCommand("plugin-a", {
      name: "greet",
      description: "Say hello",
      handler: async () => ({ text: "Hello!" }),
    });
    const result = registerPluginCommand("plugin-b", {
      name: "greet",
      description: "Say hello again",
      handler: async () => ({ text: "Hi!" }),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("already registered");
  });

  it("rejects command with non-function handler", () => {
    const result = registerPluginCommand("test-plugin", {
      name: "greet",
      description: "Say hello",
      handler: "not-a-function" as unknown as () => Promise<{ text: string }>,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("must be a function");
  });

  it("rejects reserved command names", () => {
    const result = registerPluginCommand("test-plugin", {
      name: "status",
      description: "Status check",
      handler: async () => ({ text: "OK" }),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("reserved");
  });
});

describe("matchPluginCommand", () => {
  it("returns null for non-slash input", () => {
    expect(matchPluginCommand("hello")).toBeNull();
  });

  it("returns null for unregistered command", () => {
    expect(matchPluginCommand("/unknown")).toBeNull();
  });

  it("matches a registered command without args", () => {
    registerPluginCommand("test-plugin", {
      name: "greet",
      description: "Say hello",
      acceptsArgs: true,
      handler: async () => ({ text: "Hello!" }),
    });
    const match = matchPluginCommand("/greet");
    expect(match).not.toBeNull();
    expect(match!.command.name).toBe("greet");
    expect(match!.args).toBeUndefined();
  });

  it("matches a registered command with args", () => {
    registerPluginCommand("test-plugin", {
      name: "greet",
      description: "Say hello",
      acceptsArgs: true,
      handler: async () => ({ text: "Hello!" }),
    });
    const match = matchPluginCommand("/greet world");
    expect(match).not.toBeNull();
    expect(match!.args).toBe("world");
  });

  it("does not match when args provided but not accepted", () => {
    registerPluginCommand("test-plugin", {
      name: "greet",
      description: "Say hello",
      acceptsArgs: false,
      handler: async () => ({ text: "Hello!" }),
    });
    const match = matchPluginCommand("/greet extra");
    expect(match).toBeNull();
  });

  it("matches case-insensitively", () => {
    registerPluginCommand("test-plugin", {
      name: "greet",
      description: "Say hello",
      handler: async () => ({ text: "Hello!" }),
    });
    const match = matchPluginCommand("/GREET");
    expect(match).not.toBeNull();
  });
});

describe("clearPluginCommands", () => {
  it("clears all registered commands", () => {
    registerPluginCommand("test-plugin", {
      name: "greet",
      description: "Say hello",
      handler: async () => ({ text: "Hello!" }),
    });
    clearPluginCommands();
    expect(matchPluginCommand("/greet")).toBeNull();
  });
});

describe("clearPluginCommandsForPlugin", () => {
  it("clears commands for a specific plugin only", () => {
    registerPluginCommand("plugin-a", {
      name: "cmd-a",
      description: "A",
      handler: async () => ({ text: "A" }),
    });
    registerPluginCommand("plugin-b", {
      name: "cmd-b",
      description: "B",
      handler: async () => ({ text: "B" }),
    });
    clearPluginCommandsForPlugin("plugin-a");
    expect(matchPluginCommand("/cmd-a")).toBeNull();
    expect(matchPluginCommand("/cmd-b")).not.toBeNull();
  });
});

describe("listPluginCommands", () => {
  it("returns empty list when no commands registered", () => {
    expect(listPluginCommands()).toEqual([]);
  });

  it("returns registered commands", () => {
    registerPluginCommand("test-plugin", {
      name: "greet",
      description: "Say hello",
      handler: async () => ({ text: "Hello!" }),
    });
    const list = listPluginCommands();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("greet");
    expect(list[0].description).toBe("Say hello");
    expect(list[0].pluginId).toBe("test-plugin");
  });
});

describe("getPluginCommandSpecs", () => {
  it("returns specs without pluginId", () => {
    registerPluginCommand("test-plugin", {
      name: "greet",
      description: "Say hello",
      handler: async () => ({ text: "Hello!" }),
    });
    const specs = getPluginCommandSpecs();
    expect(specs).toHaveLength(1);
    expect(specs[0]).toEqual({ name: "greet", description: "Say hello" });
  });
});

describe("executePluginCommand", () => {
  it("executes handler and returns result", async () => {
    const cmd = {
      name: "greet",
      description: "Say hello",
      pluginId: "test-plugin",
      handler: async () => ({ text: "Hello!" }),
    };
    const result = await executePluginCommand({
      command: cmd,
      args: undefined,
      channel: "telegram",
      isAuthorizedSender: true,
      commandBody: "/greet",
      config: {},
    });
    expect(result.text).toBe("Hello!");
  });

  it("blocks unauthorized sender when requireAuth is true", async () => {
    const cmd = {
      name: "greet",
      description: "Say hello",
      pluginId: "test-plugin",
      requireAuth: true,
      handler: async () => ({ text: "Hello!" }),
    };
    const result = await executePluginCommand({
      command: cmd,
      args: undefined,
      channel: "telegram",
      isAuthorizedSender: false,
      commandBody: "/greet",
      config: {},
    });
    expect(result.text).toContain("authorization");
  });

  it("allows unauthorized sender when requireAuth is false", async () => {
    const cmd = {
      name: "greet",
      description: "Say hello",
      pluginId: "test-plugin",
      requireAuth: false,
      handler: async () => ({ text: "Hello!" }),
    };
    const result = await executePluginCommand({
      command: cmd,
      args: undefined,
      channel: "telegram",
      isAuthorizedSender: false,
      commandBody: "/greet",
      config: {},
    });
    expect(result.text).toBe("Hello!");
  });

  it("returns error message when handler throws", async () => {
    const cmd = {
      name: "fail",
      description: "Fail",
      pluginId: "test-plugin",
      handler: async () => {
        throw new Error("boom");
      },
    };
    const result = await executePluginCommand({
      command: cmd,
      args: undefined,
      channel: "telegram",
      isAuthorizedSender: true,
      commandBody: "/fail",
      config: {},
    });
    expect(result.text).toContain("failed");
  });

  it("truncates long args for defense-in-depth", async () => {
    let receivedArgs: string | undefined;
    const cmd = {
      name: "echo",
      description: "Echo",
      pluginId: "test-plugin",
      handler: async (ctx: { args?: string }) => {
        receivedArgs = ctx.args;
        return { text: "ok" };
      },
    };
    const longArgs = "x".repeat(5000);
    await executePluginCommand({
      command: cmd,
      args: longArgs,
      channel: "telegram",
      isAuthorizedSender: true,
      commandBody: `/echo ${longArgs}`,
      config: {},
    });
    expect(receivedArgs!.length).toBeLessThanOrEqual(4096);
  });
});
