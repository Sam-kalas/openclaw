import { describe, expect, it } from "vitest";
import { parseAbsoluteTimeMs } from "../cron/parse.js";
import { migrateLegacyCronPayload } from "../cron/payload-migration.js";
import { validateScheduleTimestamp } from "../cron/validate-timestamp.js";
import {
  normalizeInputProvenance,
  isInterSessionInputProvenance,
  hasInterSessionUserProvenance,
} from "./input-provenance.js";
import {
  parseAgentSessionKey,
  isCronRunSessionKey,
  isSubagentSessionKey,
  isAcpSessionKey,
  resolveThreadParentSessionKey,
} from "./session-key-utils.js";
import { parseSessionLabel, SESSION_LABEL_MAX_LENGTH } from "./session-label.js";
import { onSessionTranscriptUpdate, emitSessionTranscriptUpdate } from "./transcript-events.js";

// ---------------------------------------------------------------------------
// session-key-utils.ts: parseAgentSessionKey
// ---------------------------------------------------------------------------

describe("session-key-utils: parseAgentSessionKey", () => {
  it("parses a valid agent session key", () => {
    const result = parseAgentSessionKey("agent:main:dm:12345");
    expect(result).toEqual({ agentId: "main", rest: "dm:12345" });
  });

  it("returns null for empty string", () => {
    expect(parseAgentSessionKey("")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(parseAgentSessionKey(null)).toBeNull();
    expect(parseAgentSessionKey(undefined)).toBeNull();
  });

  it("returns null when prefix is not 'agent'", () => {
    expect(parseAgentSessionKey("session:main:foo")).toBeNull();
  });

  it("returns null when fewer than 3 parts", () => {
    expect(parseAgentSessionKey("agent:main")).toBeNull();
  });

  it("joins rest with colons when more than 3 parts", () => {
    const result = parseAgentSessionKey("agent:news:cron:job1:run:abc");
    expect(result).toEqual({ agentId: "news", rest: "cron:job1:run:abc" });
  });

  it("trims whitespace", () => {
    const result = parseAgentSessionKey("  agent:main:dm:99  ");
    expect(result).toEqual({ agentId: "main", rest: "dm:99" });
  });
});

// ---------------------------------------------------------------------------
// session-key-utils.ts: isCronRunSessionKey
// ---------------------------------------------------------------------------

describe("session-key-utils: isCronRunSessionKey", () => {
  it("returns true for valid cron run session key", () => {
    expect(isCronRunSessionKey("agent:main:cron:job1:run:abc")).toBe(true);
  });

  it("returns false for non-cron agent key", () => {
    expect(isCronRunSessionKey("agent:main:dm:12345")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isCronRunSessionKey(null)).toBe(false);
    expect(isCronRunSessionKey(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCronRunSessionKey("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// session-key-utils.ts: isSubagentSessionKey
// ---------------------------------------------------------------------------

describe("session-key-utils: isSubagentSessionKey", () => {
  it("returns true for direct subagent: prefix", () => {
    expect(isSubagentSessionKey("subagent:abc")).toBe(true);
  });

  it("returns true for agent:X:subagent: form", () => {
    expect(isSubagentSessionKey("agent:main:subagent:task1")).toBe(true);
  });

  it("returns false for non-subagent key", () => {
    expect(isSubagentSessionKey("agent:main:dm:12345")).toBe(false);
  });

  it("returns false for null/undefined/empty", () => {
    expect(isSubagentSessionKey(null)).toBe(false);
    expect(isSubagentSessionKey(undefined)).toBe(false);
    expect(isSubagentSessionKey("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isSubagentSessionKey("SUBAGENT:xyz")).toBe(true);
    expect(isSubagentSessionKey("agent:main:SUBAGENT:xyz")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// session-key-utils.ts: isAcpSessionKey
// ---------------------------------------------------------------------------

describe("session-key-utils: isAcpSessionKey", () => {
  it("returns true for direct acp: prefix", () => {
    expect(isAcpSessionKey("acp:session1")).toBe(true);
  });

  it("returns true for agent:X:acp: form", () => {
    expect(isAcpSessionKey("agent:main:acp:session2")).toBe(true);
  });

  it("returns false for non-acp key", () => {
    expect(isAcpSessionKey("agent:main:dm:12345")).toBe(false);
  });

  it("returns false for null/undefined/empty", () => {
    expect(isAcpSessionKey(null)).toBe(false);
    expect(isAcpSessionKey(undefined)).toBe(false);
    expect(isAcpSessionKey("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isAcpSessionKey("ACP:xyz")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// session-key-utils.ts: resolveThreadParentSessionKey
// ---------------------------------------------------------------------------

describe("session-key-utils: resolveThreadParentSessionKey", () => {
  it("extracts parent from :thread: marker", () => {
    expect(resolveThreadParentSessionKey("agent:main:dm:123:thread:456")).toBe("agent:main:dm:123");
  });

  it("extracts parent from :topic: marker", () => {
    expect(resolveThreadParentSessionKey("agent:main:dm:123:topic:789")).toBe("agent:main:dm:123");
  });

  it("returns null when no thread/topic marker", () => {
    expect(resolveThreadParentSessionKey("agent:main:dm:123")).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(resolveThreadParentSessionKey(null)).toBeNull();
    expect(resolveThreadParentSessionKey(undefined)).toBeNull();
    expect(resolveThreadParentSessionKey("")).toBeNull();
  });

  it("uses the last marker when multiple exist", () => {
    const key = "agent:main:thread:a:topic:b";
    const result = resolveThreadParentSessionKey(key);
    // :topic: is at a later index than :thread:, so parent is everything before :topic:
    expect(result).toBe("agent:main:thread:a");
  });
});

// ---------------------------------------------------------------------------
// session-label.ts: parseSessionLabel
// ---------------------------------------------------------------------------

describe("session-label: parseSessionLabel", () => {
  it("parses a valid label", () => {
    expect(parseSessionLabel("my session")).toEqual({ ok: true, label: "my session" });
  });

  it("trims whitespace", () => {
    expect(parseSessionLabel("  hello  ")).toEqual({ ok: true, label: "hello" });
  });

  it("rejects non-string input", () => {
    expect(parseSessionLabel(42)).toEqual({ ok: false, error: "invalid label: must be a string" });
    expect(parseSessionLabel(null)).toEqual({
      ok: false,
      error: "invalid label: must be a string",
    });
  });

  it("rejects empty string", () => {
    expect(parseSessionLabel("")).toEqual({ ok: false, error: "invalid label: empty" });
  });

  it("rejects whitespace-only string", () => {
    expect(parseSessionLabel("   ")).toEqual({ ok: false, error: "invalid label: empty" });
  });

  it("rejects labels longer than max length", () => {
    const long = "a".repeat(SESSION_LABEL_MAX_LENGTH + 1);
    const result = parseSessionLabel(long);
    expect(result.ok).toBe(false);
  });

  it("accepts labels at exactly max length", () => {
    const exact = "a".repeat(SESSION_LABEL_MAX_LENGTH);
    expect(parseSessionLabel(exact)).toEqual({ ok: true, label: exact });
  });
});

// ---------------------------------------------------------------------------
// input-provenance.ts: normalizeInputProvenance
// ---------------------------------------------------------------------------

describe("input-provenance: normalizeInputProvenance", () => {
  it("normalizes valid external_user provenance", () => {
    const result = normalizeInputProvenance({ kind: "external_user" });
    expect(result).toEqual({
      kind: "external_user",
      sourceSessionKey: undefined,
      sourceChannel: undefined,
      sourceTool: undefined,
    });
  });

  it("normalizes valid inter_session provenance with optional fields", () => {
    const result = normalizeInputProvenance({
      kind: "inter_session",
      sourceSessionKey: "agent:main:dm:123",
      sourceChannel: "telegram",
    });
    expect(result).toEqual({
      kind: "inter_session",
      sourceSessionKey: "agent:main:dm:123",
      sourceChannel: "telegram",
      sourceTool: undefined,
    });
  });

  it("returns undefined for null/undefined", () => {
    expect(normalizeInputProvenance(null)).toBeUndefined();
    expect(normalizeInputProvenance(undefined)).toBeUndefined();
  });

  it("returns undefined for non-object", () => {
    expect(normalizeInputProvenance("string")).toBeUndefined();
    expect(normalizeInputProvenance(42)).toBeUndefined();
  });

  it("returns undefined for invalid kind", () => {
    expect(normalizeInputProvenance({ kind: "invalid" })).toBeUndefined();
  });

  it("trims optional string fields and ignores empty ones", () => {
    const result = normalizeInputProvenance({
      kind: "internal_system",
      sourceSessionKey: "  ",
      sourceTool: "  exec  ",
    });
    expect(result?.sourceSessionKey).toBeUndefined();
    expect(result?.sourceTool).toBe("exec");
  });
});

// ---------------------------------------------------------------------------
// input-provenance.ts: isInterSessionInputProvenance
// ---------------------------------------------------------------------------

describe("input-provenance: isInterSessionInputProvenance", () => {
  it("returns true for inter_session kind", () => {
    expect(isInterSessionInputProvenance({ kind: "inter_session" })).toBe(true);
  });

  it("returns false for other kinds", () => {
    expect(isInterSessionInputProvenance({ kind: "external_user" })).toBe(false);
    expect(isInterSessionInputProvenance({ kind: "internal_system" })).toBe(false);
  });

  it("returns false for invalid input", () => {
    expect(isInterSessionInputProvenance(null)).toBe(false);
    expect(isInterSessionInputProvenance("string")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// input-provenance.ts: hasInterSessionUserProvenance
// ---------------------------------------------------------------------------

describe("input-provenance: hasInterSessionUserProvenance", () => {
  it("returns true for user message with inter_session provenance", () => {
    expect(
      hasInterSessionUserProvenance({
        role: "user",
        provenance: { kind: "inter_session" },
      }),
    ).toBe(true);
  });

  it("returns false for non-user role", () => {
    expect(
      hasInterSessionUserProvenance({
        role: "assistant",
        provenance: { kind: "inter_session" },
      }),
    ).toBe(false);
  });

  it("returns false when no provenance", () => {
    expect(hasInterSessionUserProvenance({ role: "user" })).toBe(false);
  });

  it("returns false for undefined message", () => {
    expect(hasInterSessionUserProvenance(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// transcript-events.ts
// ---------------------------------------------------------------------------

describe("transcript-events: onSessionTranscriptUpdate + emitSessionTranscriptUpdate", () => {
  it("calls registered listener on emit", () => {
    const calls: string[] = [];
    const unsub = onSessionTranscriptUpdate((update) => {
      calls.push(update.sessionFile);
    });
    emitSessionTranscriptUpdate("session-abc.jsonl");
    expect(calls).toEqual(["session-abc.jsonl"]);
    unsub();
  });

  it("does not call listener after unsubscribe", () => {
    const calls: string[] = [];
    const unsub = onSessionTranscriptUpdate((update) => {
      calls.push(update.sessionFile);
    });
    unsub();
    emitSessionTranscriptUpdate("session-def.jsonl");
    expect(calls).toEqual([]);
  });

  it("ignores empty session file names", () => {
    const calls: string[] = [];
    const unsub = onSessionTranscriptUpdate((update) => {
      calls.push(update.sessionFile);
    });
    emitSessionTranscriptUpdate("");
    emitSessionTranscriptUpdate("   ");
    expect(calls).toEqual([]);
    unsub();
  });

  it("trims session file names", () => {
    const calls: string[] = [];
    const unsub = onSessionTranscriptUpdate((update) => {
      calls.push(update.sessionFile);
    });
    emitSessionTranscriptUpdate("  file.jsonl  ");
    expect(calls).toEqual(["file.jsonl"]);
    unsub();
  });
});

// ---------------------------------------------------------------------------
// cron/parse.ts: parseAbsoluteTimeMs
// ---------------------------------------------------------------------------

describe("cron/parse: parseAbsoluteTimeMs", () => {
  it("parses numeric epoch milliseconds string", () => {
    expect(parseAbsoluteTimeMs("1700000000000")).toBe(1700000000000);
  });

  it("parses ISO date (YYYY-MM-DD) as UTC midnight", () => {
    const result = parseAbsoluteTimeMs("2026-01-15");
    expect(result).toBe(Date.parse("2026-01-15T00:00:00Z"));
  });

  it("parses ISO datetime without timezone as UTC", () => {
    const result = parseAbsoluteTimeMs("2026-01-15T10:30:00");
    expect(result).toBe(Date.parse("2026-01-15T10:30:00Z"));
  });

  it("parses ISO datetime with Z suffix", () => {
    const result = parseAbsoluteTimeMs("2026-01-15T10:30:00Z");
    expect(result).toBe(Date.parse("2026-01-15T10:30:00Z"));
  });

  it("parses ISO datetime with timezone offset", () => {
    const result = parseAbsoluteTimeMs("2026-01-15T10:30:00+02:00");
    expect(result).toBe(Date.parse("2026-01-15T10:30:00+02:00"));
  });

  it("returns null for empty string", () => {
    expect(parseAbsoluteTimeMs("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(parseAbsoluteTimeMs("   ")).toBeNull();
  });

  it("returns null for invalid date strings", () => {
    expect(parseAbsoluteTimeMs("not-a-date")).toBeNull();
  });

  it("treats '0' as a date string (falls through numeric check)", () => {
    // "0" fails the n > 0 numeric check but Date.parse("0") = Jan 1 2000
    const result = parseAbsoluteTimeMs("0");
    expect(result).toBeTypeOf("number");
    expect(result).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// cron/validate-timestamp.ts: validateScheduleTimestamp
// ---------------------------------------------------------------------------

describe("cron/validate-timestamp: validateScheduleTimestamp", () => {
  const NOW_MS = Date.parse("2026-02-15T12:00:00Z");

  it("returns ok for non-at schedule kinds", () => {
    expect(validateScheduleTimestamp({ kind: "every", everyMs: 60000 }, NOW_MS)).toEqual({
      ok: true,
    });
    expect(validateScheduleTimestamp({ kind: "cron", expr: "*/5 * * * *" }, NOW_MS)).toEqual({
      ok: true,
    });
  });

  it("returns ok for a timestamp 1 hour in the future", () => {
    const result = validateScheduleTimestamp({ kind: "at", at: "2026-02-15T13:00:00Z" }, NOW_MS);
    expect(result).toEqual({ ok: true });
  });

  it("returns ok for a timestamp within 1-minute grace period in the past", () => {
    // 30 seconds ago
    const thirtySecsAgo = new Date(NOW_MS - 30000).toISOString();
    const result = validateScheduleTimestamp({ kind: "at", at: thirtySecsAgo }, NOW_MS);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a timestamp more than 1 minute in the past", () => {
    // 2 minutes ago
    const twoMinsAgo = new Date(NOW_MS - 120000).toISOString();
    const result = validateScheduleTimestamp({ kind: "at", at: twoMinsAgo }, NOW_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("in the past");
    }
  });

  it("rejects a timestamp more than 10 years in the future", () => {
    const result = validateScheduleTimestamp({ kind: "at", at: "2040-01-01T00:00:00Z" }, NOW_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("too far in the future");
    }
  });

  it("rejects invalid at value", () => {
    const result = validateScheduleTimestamp({ kind: "at", at: "not-a-date" }, NOW_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Invalid schedule.at");
    }
  });
});

// ---------------------------------------------------------------------------
// cron/payload-migration.ts: migrateLegacyCronPayload
// ---------------------------------------------------------------------------

describe("cron/payload-migration: migrateLegacyCronPayload", () => {
  it("migrates provider to channel", () => {
    const payload: Record<string, unknown> = { provider: "Telegram" };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect(payload.channel).toBe("telegram");
    expect("provider" in payload).toBe(false);
  });

  it("normalizes existing channel to lowercase", () => {
    const payload: Record<string, unknown> = { channel: "  Discord  " };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect(payload.channel).toBe("discord");
  });

  it("prefers channel over provider when both exist", () => {
    const payload: Record<string, unknown> = { channel: "Slack", provider: "Telegram" };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect(payload.channel).toBe("slack");
    expect("provider" in payload).toBe(false);
  });

  it("returns false when no mutation needed", () => {
    const payload: Record<string, unknown> = { channel: "telegram", message: "hi" };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(false);
    expect(payload.channel).toBe("telegram");
  });

  it("deletes provider even when channel is empty", () => {
    const payload: Record<string, unknown> = { provider: "" };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect("provider" in payload).toBe(false);
  });

  it("handles payload with no channel or provider", () => {
    const payload: Record<string, unknown> = { message: "hello" };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(false);
  });
});
