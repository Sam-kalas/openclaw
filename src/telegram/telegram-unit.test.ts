import { describe, expect, it } from "vitest";
// ────────────────────────────────────────────────────────────────
// 1. caption.ts — splitTelegramCaption
// ────────────────────────────────────────────────────────────────
import { splitTelegramCaption, TELEGRAM_MAX_CAPTION_LENGTH } from "./caption.js";

describe("splitTelegramCaption", () => {
  it("returns undefined for empty text", () => {
    expect(splitTelegramCaption("")).toEqual({
      caption: undefined,
      followUpText: undefined,
    });
  });

  it("returns undefined for undefined text", () => {
    expect(splitTelegramCaption(undefined)).toEqual({
      caption: undefined,
      followUpText: undefined,
    });
  });

  it("returns undefined for whitespace-only text", () => {
    expect(splitTelegramCaption("   ")).toEqual({
      caption: undefined,
      followUpText: undefined,
    });
  });

  it("uses text as caption when under limit", () => {
    const text = "Short caption";
    expect(splitTelegramCaption(text)).toEqual({
      caption: text,
      followUpText: undefined,
    });
  });

  it("uses text as caption at exactly the limit", () => {
    const text = "a".repeat(TELEGRAM_MAX_CAPTION_LENGTH);
    expect(splitTelegramCaption(text)).toEqual({
      caption: text,
      followUpText: undefined,
    });
  });

  it("moves text to followUpText when over limit", () => {
    const text = "a".repeat(TELEGRAM_MAX_CAPTION_LENGTH + 1);
    expect(splitTelegramCaption(text)).toEqual({
      caption: undefined,
      followUpText: text,
    });
  });

  it("trims whitespace before length check", () => {
    const text = "  Short  ";
    expect(splitTelegramCaption(text)).toEqual({
      caption: "Short",
      followUpText: undefined,
    });
  });

  it("exports the expected max caption length", () => {
    expect(TELEGRAM_MAX_CAPTION_LENGTH).toBe(1024);
  });
});

// ────────────────────────────────────────────────────────────────
// 2. bot-access.ts — normalizeAllowFrom, isSenderAllowed, etc.
// ────────────────────────────────────────────────────────────────
import {
  normalizeAllowFrom,
  normalizeAllowFromWithStore,
  firstDefined,
  isSenderAllowed,
  resolveSenderAllowMatch,
} from "./bot-access.js";

describe("normalizeAllowFrom", () => {
  it("returns empty for undefined list", () => {
    const result = normalizeAllowFrom(undefined);
    expect(result.entries).toEqual([]);
    expect(result.hasWildcard).toBe(false);
    expect(result.hasEntries).toBe(false);
  });

  it("returns empty for empty list", () => {
    const result = normalizeAllowFrom([]);
    expect(result.entries).toEqual([]);
    expect(result.hasWildcard).toBe(false);
    expect(result.hasEntries).toBe(false);
  });

  it("detects wildcard entry", () => {
    const result = normalizeAllowFrom(["*"]);
    expect(result.hasWildcard).toBe(true);
    expect(result.hasEntries).toBe(true);
    expect(result.entries).toEqual([]); // wildcard is filtered out of entries
  });

  it("strips telegram: prefix from entries", () => {
    const result = normalizeAllowFrom(["telegram:123", "tg:456"]);
    expect(result.entries).toEqual(["123", "456"]);
  });

  it("strips prefix case-insensitively", () => {
    const result = normalizeAllowFrom(["Telegram:123", "TG:456"]);
    expect(result.entries).toEqual(["123", "456"]);
  });

  it("converts numbers to strings", () => {
    const result = normalizeAllowFrom([123, 456]);
    expect(result.entries).toEqual(["123", "456"]);
  });

  it("provides lowercased entries for case-insensitive matching", () => {
    const result = normalizeAllowFrom(["UserName"]);
    expect(result.entriesLower).toEqual(["username"]);
  });

  it("filters out empty/whitespace entries", () => {
    const result = normalizeAllowFrom(["", " ", "valid"]);
    expect(result.entries).toEqual(["valid"]);
  });
});

describe("normalizeAllowFromWithStore", () => {
  it("merges allowFrom and storeAllowFrom", () => {
    const result = normalizeAllowFromWithStore({
      allowFrom: ["123"],
      storeAllowFrom: ["456"],
    });
    expect(result.entries).toEqual(["123", "456"]);
    expect(result.hasEntries).toBe(true);
  });

  it("handles missing arrays", () => {
    const result = normalizeAllowFromWithStore({});
    expect(result.entries).toEqual([]);
    expect(result.hasEntries).toBe(false);
  });
});

describe("firstDefined", () => {
  it("returns the first defined value", () => {
    expect(firstDefined(undefined, "a", "b")).toBe("a");
  });

  it("returns undefined when all are undefined", () => {
    expect(firstDefined(undefined, undefined)).toBeUndefined();
  });

  it("returns the first value when it is defined", () => {
    expect(firstDefined("a", "b")).toBe("a");
  });

  it("returns 0 (not skipping falsy values)", () => {
    expect(firstDefined(0, 1)).toBe(0);
  });

  it("returns null (not skipping null)", () => {
    expect(firstDefined(null, "a")).toBeNull();
  });
});

describe("isSenderAllowed", () => {
  it("returns true when allowlist is empty (no restrictions)", () => {
    const allow = normalizeAllowFrom([]);
    expect(isSenderAllowed({ allow, senderId: "123" })).toBe(true);
  });

  it("returns true for wildcard", () => {
    const allow = normalizeAllowFrom(["*"]);
    expect(isSenderAllowed({ allow, senderId: "123" })).toBe(true);
  });

  it("allows by sender ID", () => {
    const allow = normalizeAllowFrom(["123", "456"]);
    expect(isSenderAllowed({ allow, senderId: "123" })).toBe(true);
  });

  it("denies unknown sender ID", () => {
    const allow = normalizeAllowFrom(["123"]);
    expect(isSenderAllowed({ allow, senderId: "999" })).toBe(false);
  });

  it("allows by username (case-insensitive)", () => {
    const allow = normalizeAllowFrom(["JohnDoe"]);
    expect(isSenderAllowed({ allow, senderUsername: "johndoe" })).toBe(true);
  });

  it("allows by @username format", () => {
    const allow = normalizeAllowFrom(["@johndoe"]);
    expect(isSenderAllowed({ allow, senderUsername: "johndoe" })).toBe(true);
  });

  it("denies when no sender info matches", () => {
    const allow = normalizeAllowFrom(["123"]);
    expect(isSenderAllowed({ allow })).toBe(false);
  });
});

describe("resolveSenderAllowMatch", () => {
  it("returns wildcard match for wildcard list", () => {
    const allow = normalizeAllowFrom(["*"]);
    const result = resolveSenderAllowMatch({ allow, senderId: "123" });
    expect(result).toEqual({ allowed: true, matchKey: "*", matchSource: "wildcard" });
  });

  it("returns id match for numeric ID", () => {
    const allow = normalizeAllowFrom(["123"]);
    const result = resolveSenderAllowMatch({ allow, senderId: "123" });
    expect(result).toEqual({ allowed: true, matchKey: "123", matchSource: "id" });
  });

  it("returns username match for username", () => {
    const allow = normalizeAllowFrom(["johndoe"]);
    const result = resolveSenderAllowMatch({ allow, senderUsername: "johndoe" });
    expect(result.allowed).toBe(true);
    expect(result.matchSource).toBe("username");
  });

  it("returns not allowed when no match", () => {
    const allow = normalizeAllowFrom(["123"]);
    const result = resolveSenderAllowMatch({ allow, senderId: "999" });
    expect(result).toEqual({ allowed: false });
  });

  it("returns not allowed when list has entries but no match", () => {
    const allow = normalizeAllowFrom(["456"]);
    const result = resolveSenderAllowMatch({ allow });
    expect(result).toEqual({ allowed: false });
  });
});

// ────────────────────────────────────────────────────────────────
// 3. allowed-updates.ts — resolveTelegramAllowedUpdates
// ────────────────────────────────────────────────────────────────
import { resolveTelegramAllowedUpdates } from "./allowed-updates.js";

describe("resolveTelegramAllowedUpdates", () => {
  it("returns an array", () => {
    const result = resolveTelegramAllowedUpdates();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes message_reaction", () => {
    const result = resolveTelegramAllowedUpdates();
    expect(result).toContain("message_reaction");
  });

  it("includes standard update types", () => {
    const result = resolveTelegramAllowedUpdates();
    expect(result).toContain("message");
    expect(result).toContain("callback_query");
  });
});
