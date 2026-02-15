import { describe, expect, it } from "vitest";
import {
  parseAgentSessionKey,
  isCronRunSessionKey,
  isSubagentSessionKey,
  isAcpSessionKey,
  resolveThreadParentSessionKey,
} from "./session-key-utils.js";

describe("parseAgentSessionKey", () => {
  it("returns null for empty/undefined/null input", () => {
    expect(parseAgentSessionKey(undefined)).toBeNull();
    expect(parseAgentSessionKey(null)).toBeNull();
    expect(parseAgentSessionKey("")).toBeNull();
    expect(parseAgentSessionKey("  ")).toBeNull();
  });

  it("returns null when fewer than 3 parts", () => {
    expect(parseAgentSessionKey("agent")).toBeNull();
    expect(parseAgentSessionKey("agent:main")).toBeNull();
  });

  it("returns null when first part is not 'agent'", () => {
    expect(parseAgentSessionKey("session:main:rest")).toBeNull();
    expect(parseAgentSessionKey("foo:bar:baz")).toBeNull();
  });

  it("parses valid agent session keys", () => {
    const result = parseAgentSessionKey("agent:main:dm:123");
    expect(result).toEqual({ agentId: "main", rest: "dm:123" });
  });

  it("handles single rest segment", () => {
    const result = parseAgentSessionKey("agent:news:isolated");
    expect(result).toEqual({ agentId: "news", rest: "isolated" });
  });

  it("handles multiple rest segments", () => {
    const result = parseAgentSessionKey("agent:main:cron:job1:run:abc");
    expect(result).toEqual({ agentId: "main", rest: "cron:job1:run:abc" });
  });

  it("filters out empty parts from split", () => {
    expect(parseAgentSessionKey("agent::main")).toBeNull();
  });
});

describe("isCronRunSessionKey", () => {
  it("returns false for non-agent keys", () => {
    expect(isCronRunSessionKey(undefined)).toBe(false);
    expect(isCronRunSessionKey(null)).toBe(false);
    expect(isCronRunSessionKey("")).toBe(false);
    expect(isCronRunSessionKey("main:dm:123")).toBe(false);
  });

  it("returns true for cron run session keys", () => {
    expect(isCronRunSessionKey("agent:main:cron:job1:run:abc")).toBe(true);
    expect(isCronRunSessionKey("agent:news:cron:briefing:run:xyz")).toBe(true);
  });

  it("returns false for non-cron agent keys", () => {
    expect(isCronRunSessionKey("agent:main:dm:123")).toBe(false);
    expect(isCronRunSessionKey("agent:main:subagent:x")).toBe(false);
  });

  it("returns false for partial cron keys", () => {
    expect(isCronRunSessionKey("agent:main:cron:job1")).toBe(false);
    expect(isCronRunSessionKey("agent:main:cron:job1:run")).toBe(false);
  });
});

describe("isSubagentSessionKey", () => {
  it("returns false for empty/null/undefined", () => {
    expect(isSubagentSessionKey(undefined)).toBe(false);
    expect(isSubagentSessionKey(null)).toBe(false);
    expect(isSubagentSessionKey("")).toBe(false);
    expect(isSubagentSessionKey("  ")).toBe(false);
  });

  it("detects top-level subagent: prefix", () => {
    expect(isSubagentSessionKey("subagent:abc")).toBe(true);
    expect(isSubagentSessionKey("SUBAGENT:abc")).toBe(true);
    expect(isSubagentSessionKey("Subagent:abc")).toBe(true);
  });

  it("detects agent-prefixed subagent keys", () => {
    expect(isSubagentSessionKey("agent:main:subagent:abc")).toBe(true);
  });

  it("returns false for non-subagent keys", () => {
    expect(isSubagentSessionKey("agent:main:dm:123")).toBe(false);
    expect(isSubagentSessionKey("main:dm:123")).toBe(false);
  });
});

describe("isAcpSessionKey", () => {
  it("returns false for empty/null/undefined", () => {
    expect(isAcpSessionKey(undefined)).toBe(false);
    expect(isAcpSessionKey(null)).toBe(false);
    expect(isAcpSessionKey("")).toBe(false);
  });

  it("detects top-level acp: prefix", () => {
    expect(isAcpSessionKey("acp:session1")).toBe(true);
    expect(isAcpSessionKey("ACP:session1")).toBe(true);
  });

  it("detects agent-prefixed acp keys", () => {
    expect(isAcpSessionKey("agent:main:acp:session1")).toBe(true);
  });

  it("returns false for non-acp keys", () => {
    expect(isAcpSessionKey("agent:main:dm:123")).toBe(false);
    expect(isAcpSessionKey("subagent:abc")).toBe(false);
  });
});

describe("resolveThreadParentSessionKey", () => {
  it("returns null for empty/null/undefined", () => {
    expect(resolveThreadParentSessionKey(undefined)).toBeNull();
    expect(resolveThreadParentSessionKey(null)).toBeNull();
    expect(resolveThreadParentSessionKey("")).toBeNull();
  });

  it("returns null when no thread/topic marker found", () => {
    expect(resolveThreadParentSessionKey("agent:main:dm:123")).toBeNull();
    expect(resolveThreadParentSessionKey("main:group:abc")).toBeNull();
  });

  it("extracts parent from :thread: marker", () => {
    expect(resolveThreadParentSessionKey("telegram:group:abc:thread:123")).toBe(
      "telegram:group:abc",
    );
  });

  it("extracts parent from :topic: marker", () => {
    expect(resolveThreadParentSessionKey("telegram:group:abc:topic:123")).toBe(
      "telegram:group:abc",
    );
  });

  it("handles case-insensitive markers", () => {
    expect(resolveThreadParentSessionKey("telegram:group:abc:THREAD:123")).toBe(
      "telegram:group:abc",
    );
    expect(resolveThreadParentSessionKey("telegram:group:abc:Topic:123")).toBe(
      "telegram:group:abc",
    );
  });

  it("uses the last marker when multiple present", () => {
    expect(resolveThreadParentSessionKey("telegram:group:abc:thread:1:topic:2")).toBe(
      "telegram:group:abc:thread:1",
    );
  });

  it("returns null when marker is at the start", () => {
    expect(resolveThreadParentSessionKey(":thread:123")).toBeNull();
  });
});
