import { describe, expect, it } from "vitest";
import {
  normalizeInputProvenance,
  isInterSessionInputProvenance,
  hasInterSessionUserProvenance,
  applyInputProvenanceToUserMessage,
  INPUT_PROVENANCE_KIND_VALUES,
} from "./input-provenance.js";

describe("normalizeInputProvenance", () => {
  it("returns undefined for non-object input", () => {
    expect(normalizeInputProvenance(undefined)).toBeUndefined();
    expect(normalizeInputProvenance(null)).toBeUndefined();
    expect(normalizeInputProvenance("string")).toBeUndefined();
    expect(normalizeInputProvenance(42)).toBeUndefined();
    expect(normalizeInputProvenance(true)).toBeUndefined();
  });

  it("returns undefined when kind is missing or invalid", () => {
    expect(normalizeInputProvenance({})).toBeUndefined();
    expect(normalizeInputProvenance({ kind: "unknown" })).toBeUndefined();
    expect(normalizeInputProvenance({ kind: 123 })).toBeUndefined();
  });

  it("normalizes valid external_user provenance", () => {
    const result = normalizeInputProvenance({ kind: "external_user" });
    expect(result).toEqual({
      kind: "external_user",
      sourceSessionKey: undefined,
      sourceChannel: undefined,
      sourceTool: undefined,
    });
  });

  it("normalizes valid inter_session provenance", () => {
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

  it("normalizes valid internal_system provenance", () => {
    const result = normalizeInputProvenance({
      kind: "internal_system",
      sourceTool: "cron",
    });
    expect(result).toEqual({
      kind: "internal_system",
      sourceSessionKey: undefined,
      sourceChannel: undefined,
      sourceTool: "cron",
    });
  });

  it("trims and ignores empty optional strings", () => {
    const result = normalizeInputProvenance({
      kind: "external_user",
      sourceSessionKey: "  ",
      sourceChannel: "",
      sourceTool: "  tool  ",
    });
    expect(result).toEqual({
      kind: "external_user",
      sourceSessionKey: undefined,
      sourceChannel: undefined,
      sourceTool: "tool",
    });
  });

  it("ignores non-string optional fields", () => {
    const result = normalizeInputProvenance({
      kind: "external_user",
      sourceSessionKey: 123,
      sourceChannel: true,
    });
    expect(result?.sourceSessionKey).toBeUndefined();
    expect(result?.sourceChannel).toBeUndefined();
  });

  it("exports all valid kind values", () => {
    expect(INPUT_PROVENANCE_KIND_VALUES).toEqual([
      "external_user",
      "inter_session",
      "internal_system",
    ]);
  });
});

describe("isInterSessionInputProvenance", () => {
  it("returns true for inter_session provenance objects", () => {
    expect(isInterSessionInputProvenance({ kind: "inter_session" })).toBe(true);
  });

  it("returns false for other kinds", () => {
    expect(isInterSessionInputProvenance({ kind: "external_user" })).toBe(false);
    expect(isInterSessionInputProvenance({ kind: "internal_system" })).toBe(false);
  });

  it("returns false for invalid input", () => {
    expect(isInterSessionInputProvenance(null)).toBe(false);
    expect(isInterSessionInputProvenance(undefined)).toBe(false);
    expect(isInterSessionInputProvenance("inter_session")).toBe(false);
  });
});

describe("hasInterSessionUserProvenance", () => {
  it("returns true for user messages with inter_session provenance", () => {
    expect(
      hasInterSessionUserProvenance({
        role: "user",
        provenance: { kind: "inter_session" },
      }),
    ).toBe(true);
  });

  it("returns false for non-user roles", () => {
    expect(
      hasInterSessionUserProvenance({
        role: "assistant",
        provenance: { kind: "inter_session" },
      }),
    ).toBe(false);
  });

  it("returns false for non-inter_session provenance", () => {
    expect(
      hasInterSessionUserProvenance({
        role: "user",
        provenance: { kind: "external_user" },
      }),
    ).toBe(false);
  });

  it("returns false for missing provenance", () => {
    expect(hasInterSessionUserProvenance({ role: "user" })).toBe(false);
  });

  it("returns false for undefined/missing message", () => {
    expect(hasInterSessionUserProvenance(undefined)).toBe(false);
  });
});

describe("applyInputProvenanceToUserMessage", () => {
  it("returns message unchanged when provenance is undefined", () => {
    const msg = { role: "user", content: "hi" } as any;
    expect(applyInputProvenanceToUserMessage(msg, undefined)).toBe(msg);
  });

  it("returns message unchanged for non-user role", () => {
    const msg = { role: "assistant", content: "hi" } as any;
    const provenance = { kind: "external_user" as const };
    expect(applyInputProvenanceToUserMessage(msg, provenance)).toBe(msg);
  });

  it("applies provenance to user message", () => {
    const msg = { role: "user", content: "hello" } as any;
    const provenance = { kind: "inter_session" as const, sourceSessionKey: "key1" };
    const result = applyInputProvenanceToUserMessage(msg, provenance) as any;
    expect(result.provenance).toEqual(provenance);
    expect(result.content).toBe("hello");
    expect(result.role).toBe("user");
  });

  it("does not overwrite existing provenance", () => {
    const existing = { kind: "external_user" as const };
    const msg = { role: "user", content: "hello", provenance: existing } as any;
    const newProvenance = { kind: "inter_session" as const };
    const result = applyInputProvenanceToUserMessage(msg, newProvenance);
    expect((result as any).provenance).toEqual(existing);
  });

  it("returns a new object (does not mutate original)", () => {
    const msg = { role: "user", content: "hello" } as any;
    const provenance = { kind: "external_user" as const };
    const result = applyInputProvenanceToUserMessage(msg, provenance);
    expect(result).not.toBe(msg);
    expect(msg.provenance).toBeUndefined();
  });
});
