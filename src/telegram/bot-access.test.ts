import { describe, expect, it } from "vitest";
import {
  normalizeAllowFrom,
  normalizeAllowFromWithStore,
  firstDefined,
  isSenderAllowed,
  resolveSenderAllowMatch,
} from "./bot-access.js";

describe("normalizeAllowFrom", () => {
  it("returns empty for undefined", () => {
    const result = normalizeAllowFrom(undefined);
    expect(result.entries).toEqual([]);
    expect(result.hasWildcard).toBe(false);
    expect(result.hasEntries).toBe(false);
  });

  it("detects wildcard", () => {
    const result = normalizeAllowFrom(["*", "123"]);
    expect(result.hasWildcard).toBe(true);
    expect(result.hasEntries).toBe(true);
    expect(result.entries).toEqual(["123"]);
  });

  it("strips telegram: and tg: prefixes", () => {
    const result = normalizeAllowFrom(["telegram:user1", "tg:user2", "user3"]);
    expect(result.entries).toEqual(["user1", "user2", "user3"]);
  });

  it("converts numbers to strings", () => {
    const result = normalizeAllowFrom([12345, "hello"]);
    expect(result.entries).toEqual(["12345", "hello"]);
  });

  it("lowercases entries for case-insensitive matching", () => {
    const result = normalizeAllowFrom(["UserName"]);
    expect(result.entriesLower).toEqual(["username"]);
  });

  it("filters empty entries", () => {
    const result = normalizeAllowFrom(["", " ", "valid"]);
    expect(result.entries).toEqual(["valid"]);
  });
});

describe("normalizeAllowFromWithStore", () => {
  it("combines allowFrom and storeAllowFrom", () => {
    const result = normalizeAllowFromWithStore({
      allowFrom: ["user1"],
      storeAllowFrom: ["user2"],
    });
    expect(result.entries).toContain("user1");
    expect(result.entries).toContain("user2");
  });

  it("handles missing inputs", () => {
    const result = normalizeAllowFromWithStore({});
    expect(result.hasEntries).toBe(false);
  });
});

describe("firstDefined", () => {
  it("returns first defined value", () => {
    expect(firstDefined(undefined, undefined, "hello")).toBe("hello");
  });

  it("returns first value if defined", () => {
    expect(firstDefined("a", "b")).toBe("a");
  });

  it("returns undefined when all undefined", () => {
    expect(firstDefined(undefined, undefined)).toBeUndefined();
  });

  it("returns false when false is first defined", () => {
    expect(firstDefined(undefined, false, true)).toBe(false);
  });

  it("returns null when null is first defined", () => {
    expect(firstDefined(undefined, null, "hello")).toBeNull();
  });
});

describe("isSenderAllowed", () => {
  it("allows when no entries configured", () => {
    const allow = normalizeAllowFrom([]);
    expect(isSenderAllowed({ allow, senderId: "123" })).toBe(true);
  });

  it("allows wildcard", () => {
    const allow = normalizeAllowFrom(["*"]);
    expect(isSenderAllowed({ allow, senderId: "anyone" })).toBe(true);
  });

  it("matches by sender ID", () => {
    const allow = normalizeAllowFrom(["123"]);
    expect(isSenderAllowed({ allow, senderId: "123" })).toBe(true);
    expect(isSenderAllowed({ allow, senderId: "456" })).toBe(false);
  });

  it("matches by username case-insensitively", () => {
    const allow = normalizeAllowFrom(["JohnDoe"]);
    expect(isSenderAllowed({ allow, senderUsername: "johndoe" })).toBe(true);
    expect(isSenderAllowed({ allow, senderUsername: "JOHNDOE" })).toBe(true);
  });

  it("matches username with @ prefix", () => {
    const allow = normalizeAllowFrom(["@johndoe"]);
    expect(isSenderAllowed({ allow, senderUsername: "johndoe" })).toBe(true);
  });

  it("denies when no match", () => {
    const allow = normalizeAllowFrom(["123"]);
    expect(isSenderAllowed({ allow, senderId: "999", senderUsername: "nobody" })).toBe(false);
  });
});

describe("resolveSenderAllowMatch", () => {
  it("returns wildcard match", () => {
    const allow = normalizeAllowFrom(["*"]);
    const match = resolveSenderAllowMatch({ allow, senderId: "123" });
    expect(match.allowed).toBe(true);
    expect(match.matchSource).toBe("wildcard");
    expect(match.matchKey).toBe("*");
  });

  it("returns id match", () => {
    const allow = normalizeAllowFrom(["12345"]);
    const match = resolveSenderAllowMatch({ allow, senderId: "12345" });
    expect(match.allowed).toBe(true);
    expect(match.matchSource).toBe("id");
    expect(match.matchKey).toBe("12345");
  });

  it("returns username match", () => {
    const allow = normalizeAllowFrom(["johndoe"]);
    const match = resolveSenderAllowMatch({ allow, senderUsername: "JohnDoe" });
    expect(match.allowed).toBe(true);
    expect(match.matchSource).toBe("username");
  });

  it("returns not allowed when no match", () => {
    const allow = normalizeAllowFrom(["other"]);
    const match = resolveSenderAllowMatch({ allow, senderId: "123" });
    expect(match.allowed).toBe(false);
    expect(match.matchKey).toBeUndefined();
  });

  it("returns not allowed when no entries", () => {
    const allow = normalizeAllowFrom([]);
    const match = resolveSenderAllowMatch({ allow, senderId: "123" });
    expect(match.allowed).toBe(false);
  });
});
