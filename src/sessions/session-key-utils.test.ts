import { describe, expect, it } from "vitest";
import {
  parseAgentSessionKey,
  isSubagentSessionKey,
  isAcpSessionKey,
  isCronRunSessionKey,
  resolveThreadParentSessionKey,
} from "./session-key-utils.js";

describe("parseAgentSessionKey", () => {
  it("returns null for empty input", () => {
    expect(parseAgentSessionKey(undefined)).toBeNull();
    expect(parseAgentSessionKey(null)).toBeNull();
    expect(parseAgentSessionKey("")).toBeNull();
  });

  it("returns null for less than 3 parts", () => {
    expect(parseAgentSessionKey("agent:foo")).toBeNull();
    expect(parseAgentSessionKey("foo:bar")).toBeNull();
  });

  it("returns null when not starting with agent:", () => {
    expect(parseAgentSessionKey("user:foo:bar")).toBeNull();
  });

  it("parses valid agent session key", () => {
    const result = parseAgentSessionKey("agent:main:session1");
    expect(result).toEqual({ agentId: "main", rest: "session1" });
  });

  it("joins remaining parts with colon", () => {
    const result = parseAgentSessionKey("agent:myagent:telegram:group:123");
    expect(result).toEqual({ agentId: "myagent", rest: "telegram:group:123" });
  });
});

describe("isSubagentSessionKey", () => {
  it("returns false for empty", () => {
    expect(isSubagentSessionKey(undefined)).toBe(false);
    expect(isSubagentSessionKey("")).toBe(false);
  });

  it("detects subagent: prefix", () => {
    expect(isSubagentSessionKey("subagent:task1")).toBe(true);
  });

  it("detects subagent in agent key rest", () => {
    expect(isSubagentSessionKey("agent:main:subagent:task1")).toBe(true);
  });

  it("returns false for regular keys", () => {
    expect(isSubagentSessionKey("agent:main:session1")).toBe(false);
  });
});

describe("isAcpSessionKey", () => {
  it("returns false for empty", () => {
    expect(isAcpSessionKey(undefined)).toBe(false);
  });

  it("detects acp: prefix", () => {
    expect(isAcpSessionKey("acp:session1")).toBe(true);
  });

  it("detects acp in agent key rest", () => {
    expect(isAcpSessionKey("agent:main:acp:session1")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAcpSessionKey("ACP:session1")).toBe(true);
  });

  it("returns false for regular keys", () => {
    expect(isAcpSessionKey("agent:main:session1")).toBe(false);
  });
});

describe("isCronRunSessionKey", () => {
  it("returns false for non-agent keys", () => {
    expect(isCronRunSessionKey("cron:task:run:1")).toBe(false);
  });

  it("detects cron run session key in agent key rest", () => {
    expect(isCronRunSessionKey("agent:main:cron:daily:run:001")).toBe(true);
  });

  it("returns false for non-cron agent keys", () => {
    expect(isCronRunSessionKey("agent:main:session1")).toBe(false);
  });
});

describe("resolveThreadParentSessionKey", () => {
  it("returns null for empty", () => {
    expect(resolveThreadParentSessionKey(undefined)).toBeNull();
    expect(resolveThreadParentSessionKey("")).toBeNull();
  });

  it("returns null when no thread marker", () => {
    expect(resolveThreadParentSessionKey("agent:main:session1")).toBeNull();
  });

  it("returns parent for :thread: marker", () => {
    expect(resolveThreadParentSessionKey("agent:main:session1:thread:42")).toBe(
      "agent:main:session1",
    );
  });

  it("returns parent for :topic: marker", () => {
    expect(resolveThreadParentSessionKey("agent:main:telegram:group:123:topic:5")).toBe(
      "agent:main:telegram:group:123",
    );
  });

  it("uses last marker when multiple exist", () => {
    expect(resolveThreadParentSessionKey("agent:main:thread:1:topic:5")).toBe(
      "agent:main:thread:1",
    );
  });
});
