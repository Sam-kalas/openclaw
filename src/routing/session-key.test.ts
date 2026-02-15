import { describe, expect, it } from "vitest";
import {
  normalizeAgentId,
  normalizeAccountId,
  normalizeMainKey,
  buildAgentMainSessionKey,
  buildGroupHistoryKey,
  resolveThreadSessionKeys,
  resolveAgentIdFromSessionKey,
  classifySessionKeyShape,
  toAgentStoreSessionKey,
  toAgentRequestSessionKey,
  sanitizeAgentId,
  DEFAULT_AGENT_ID,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_MAIN_KEY,
} from "./session-key.js";

describe("normalizeAgentId", () => {
  it("returns default for empty", () => {
    expect(normalizeAgentId(undefined)).toBe(DEFAULT_AGENT_ID);
    expect(normalizeAgentId(null)).toBe(DEFAULT_AGENT_ID);
    expect(normalizeAgentId("")).toBe(DEFAULT_AGENT_ID);
  });

  it("lowercases valid IDs", () => {
    expect(normalizeAgentId("MyAgent")).toBe("myagent");
  });

  it("cleans invalid characters", () => {
    expect(normalizeAgentId("my agent!")).toBe("my-agent");
  });

  it("strips leading/trailing dashes", () => {
    expect(normalizeAgentId("--hello--")).toBe("hello");
  });
});

describe("sanitizeAgentId", () => {
  it("behaves same as normalizeAgentId for valid input", () => {
    expect(sanitizeAgentId("MyAgent")).toBe("myagent");
    expect(sanitizeAgentId(undefined)).toBe(DEFAULT_AGENT_ID);
  });
});

describe("normalizeAccountId", () => {
  it("returns default for empty", () => {
    expect(normalizeAccountId(undefined)).toBe(DEFAULT_ACCOUNT_ID);
    expect(normalizeAccountId("")).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("lowercases valid IDs", () => {
    expect(normalizeAccountId("MyAccount")).toBe("myaccount");
  });
});

describe("normalizeMainKey", () => {
  it("returns default for empty", () => {
    expect(normalizeMainKey(undefined)).toBe(DEFAULT_MAIN_KEY);
    expect(normalizeMainKey("")).toBe(DEFAULT_MAIN_KEY);
  });

  it("lowercases", () => {
    expect(normalizeMainKey("MyKey")).toBe("mykey");
  });
});

describe("buildAgentMainSessionKey", () => {
  it("builds key from agentId", () => {
    expect(buildAgentMainSessionKey({ agentId: "main" })).toBe("agent:main:main");
  });

  it("includes mainKey", () => {
    expect(buildAgentMainSessionKey({ agentId: "bot", mainKey: "custom" })).toBe(
      "agent:bot:custom",
    );
  });
});

describe("buildGroupHistoryKey", () => {
  it("builds key from parts", () => {
    expect(
      buildGroupHistoryKey({
        channel: "telegram",
        accountId: "default",
        peerKind: "group",
        peerId: "-100123",
      }),
    ).toBe("telegram:default:group:-100123");
  });

  it("lowercases and normalizes", () => {
    expect(
      buildGroupHistoryKey({
        channel: "Telegram",
        peerKind: "group",
        peerId: "ABC",
      }),
    ).toBe("telegram:default:group:abc");
  });
});

describe("resolveThreadSessionKeys", () => {
  it("returns base key when no threadId", () => {
    const result = resolveThreadSessionKeys({ baseSessionKey: "agent:main:main" });
    expect(result.sessionKey).toBe("agent:main:main");
    expect(result.parentSessionKey).toBeUndefined();
  });

  it("appends thread suffix", () => {
    const result = resolveThreadSessionKeys({
      baseSessionKey: "agent:main:main",
      threadId: "42",
    });
    expect(result.sessionKey).toBe("agent:main:main:thread:42");
  });

  it("skips suffix when useSuffix=false", () => {
    const result = resolveThreadSessionKeys({
      baseSessionKey: "agent:main:main",
      threadId: "42",
      useSuffix: false,
    });
    expect(result.sessionKey).toBe("agent:main:main");
  });
});

describe("resolveAgentIdFromSessionKey", () => {
  it("extracts agent ID", () => {
    expect(resolveAgentIdFromSessionKey("agent:mybot:main")).toBe("mybot");
  });

  it("returns default for unparseable key", () => {
    expect(resolveAgentIdFromSessionKey("invalid")).toBe(DEFAULT_AGENT_ID);
  });
});

describe("classifySessionKeyShape", () => {
  it("returns missing for empty", () => {
    expect(classifySessionKeyShape(undefined)).toBe("missing");
    expect(classifySessionKeyShape("")).toBe("missing");
  });

  it("returns agent for valid agent key", () => {
    expect(classifySessionKeyShape("agent:main:session1")).toBe("agent");
  });

  it("returns malformed_agent for bad agent key", () => {
    expect(classifySessionKeyShape("agent:")).toBe("malformed_agent");
  });

  it("returns legacy_or_alias for non-agent key", () => {
    expect(classifySessionKeyShape("session1")).toBe("legacy_or_alias");
  });
});

describe("toAgentStoreSessionKey", () => {
  it("builds store key from request key", () => {
    const result = toAgentStoreSessionKey({
      agentId: "main",
      requestKey: "telegram:group:123",
    });
    expect(result).toBe("agent:main:telegram:group:123");
  });

  it("returns main session key for empty request key", () => {
    const result = toAgentStoreSessionKey({ agentId: "main", requestKey: "" });
    expect(result).toBe("agent:main:main");
  });

  it("returns main session key for DEFAULT_MAIN_KEY", () => {
    const result = toAgentStoreSessionKey({ agentId: "main", requestKey: DEFAULT_MAIN_KEY });
    expect(result).toBe("agent:main:main");
  });
});

describe("toAgentRequestSessionKey", () => {
  it("returns undefined for empty", () => {
    expect(toAgentRequestSessionKey(undefined)).toBeUndefined();
    expect(toAgentRequestSessionKey("")).toBeUndefined();
  });

  it("returns rest part of agent key", () => {
    expect(toAgentRequestSessionKey("agent:main:telegram:group:123")).toBe("telegram:group:123");
  });

  it("returns raw key for non-agent key", () => {
    expect(toAgentRequestSessionKey("legacy-key")).toBe("legacy-key");
  });
});
