import { describe, expect, it } from "vitest";
import {
  normalizeChannelSlug,
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
  applyChannelMatchMeta,
  resolveChannelMatchConfig,
} from "./channel-config.js";

describe("normalizeChannelSlug", () => {
  it("lowercases and trims", () => {
    expect(normalizeChannelSlug("  General  ")).toBe("general");
  });

  it("strips leading # character", () => {
    expect(normalizeChannelSlug("#general")).toBe("general");
  });

  it("replaces non-alphanumeric sequences with dashes", () => {
    expect(normalizeChannelSlug("my cool channel!")).toBe("my-cool-channel");
  });

  it("strips leading and trailing dashes", () => {
    expect(normalizeChannelSlug("---hello---")).toBe("hello");
  });

  it("handles complex input", () => {
    expect(normalizeChannelSlug("#My Cool—Channel (2024)")).toBe("my-cool-channel-2024");
  });
});

describe("buildChannelKeyCandidates", () => {
  it("returns unique non-empty trimmed keys", () => {
    expect(buildChannelKeyCandidates("a", "b", "a")).toEqual(["a", "b"]);
  });

  it("skips null and undefined", () => {
    expect(buildChannelKeyCandidates("x", undefined, null, "y")).toEqual(["x", "y"]);
  });

  it("skips empty strings", () => {
    expect(buildChannelKeyCandidates("", "  ", "a")).toEqual(["a"]);
  });

  it("trims whitespace", () => {
    expect(buildChannelKeyCandidates(" hello ", "world")).toEqual(["hello", "world"]);
  });
});

describe("resolveChannelEntryMatch", () => {
  it("matches direct entry by key", () => {
    const match = resolveChannelEntryMatch({
      entries: { foo: "bar", baz: "qux" },
      keys: ["foo"],
    });
    expect(match.entry).toBe("bar");
    expect(match.key).toBe("foo");
  });

  it("matches first available key", () => {
    const match = resolveChannelEntryMatch({
      entries: { b: 2, c: 3 },
      keys: ["a", "b", "c"],
    });
    expect(match.entry).toBe(2);
    expect(match.key).toBe("b");
  });

  it("returns empty match when no keys match", () => {
    const match = resolveChannelEntryMatch({
      entries: { foo: "bar" },
      keys: ["baz"],
    });
    expect(match.entry).toBeUndefined();
    expect(match.key).toBeUndefined();
  });

  it("resolves wildcard entry when present", () => {
    const match = resolveChannelEntryMatch({
      entries: { "*": "default", foo: "bar" },
      keys: ["foo"],
      wildcardKey: "*",
    });
    expect(match.entry).toBe("bar");
    expect(match.wildcardEntry).toBe("default");
    expect(match.wildcardKey).toBe("*");
  });
});

describe("resolveChannelEntryMatchWithFallback", () => {
  it("returns direct match with matchSource=direct", () => {
    const match = resolveChannelEntryMatchWithFallback({
      entries: { foo: "bar" },
      keys: ["foo"],
    });
    expect(match.entry).toBe("bar");
    expect(match.matchSource).toBe("direct");
    expect(match.matchKey).toBe("foo");
  });

  it("falls back to parent keys", () => {
    const match = resolveChannelEntryMatchWithFallback({
      entries: { parent: "val" },
      keys: ["child"],
      parentKeys: ["parent"],
    });
    expect(match.entry).toBe("val");
    expect(match.matchSource).toBe("parent");
  });

  it("falls back to wildcard when no direct or parent match", () => {
    const match = resolveChannelEntryMatchWithFallback({
      entries: { "*": "wildcard" },
      keys: ["missing"],
      wildcardKey: "*",
    });
    expect(match.entry).toBe("wildcard");
    expect(match.matchSource).toBe("wildcard");
  });

  it("prefers direct over parent over wildcard", () => {
    const match = resolveChannelEntryMatchWithFallback({
      entries: { exact: "direct", parent: "p", "*": "w" },
      keys: ["exact"],
      parentKeys: ["parent"],
      wildcardKey: "*",
    });
    expect(match.matchSource).toBe("direct");
    expect(match.entry).toBe("direct");
  });

  it("uses normalizeKey for fuzzy matching", () => {
    const match = resolveChannelEntryMatchWithFallback({
      entries: { "My-Channel": "val" },
      keys: ["my-channel"],
      normalizeKey: (k) => k.toLowerCase(),
    });
    expect(match.entry).toBe("val");
    expect(match.matchSource).toBe("direct");
  });
});

describe("resolveNestedAllowlistDecision", () => {
  it("allows when outer not configured", () => {
    expect(
      resolveNestedAllowlistDecision({
        outerConfigured: false,
        outerMatched: false,
        innerConfigured: false,
        innerMatched: false,
      }),
    ).toBe(true);
  });

  it("denies when outer configured but not matched", () => {
    expect(
      resolveNestedAllowlistDecision({
        outerConfigured: true,
        outerMatched: false,
        innerConfigured: false,
        innerMatched: false,
      }),
    ).toBe(false);
  });

  it("allows when outer matched and inner not configured", () => {
    expect(
      resolveNestedAllowlistDecision({
        outerConfigured: true,
        outerMatched: true,
        innerConfigured: false,
        innerMatched: false,
      }),
    ).toBe(true);
  });

  it("uses inner match when both configured and outer matched", () => {
    expect(
      resolveNestedAllowlistDecision({
        outerConfigured: true,
        outerMatched: true,
        innerConfigured: true,
        innerMatched: true,
      }),
    ).toBe(true);

    expect(
      resolveNestedAllowlistDecision({
        outerConfigured: true,
        outerMatched: true,
        innerConfigured: true,
        innerMatched: false,
      }),
    ).toBe(false);
  });
});

describe("applyChannelMatchMeta", () => {
  it("applies matchKey and matchSource to result", () => {
    const result = {
      matchKey: undefined as string | undefined,
      matchSource: undefined as string | undefined,
    };
    applyChannelMatchMeta(result, { matchKey: "foo", matchSource: "direct" });
    expect(result.matchKey).toBe("foo");
    expect(result.matchSource).toBe("direct");
  });

  it("does not overwrite when match has no meta", () => {
    const result = {
      matchKey: "existing" as string | undefined,
      matchSource: undefined as string | undefined,
    };
    applyChannelMatchMeta(result, {});
    expect(result.matchKey).toBe("existing");
  });
});

describe("resolveChannelMatchConfig", () => {
  it("returns null when no entry in match", () => {
    const result = resolveChannelMatchConfig({}, (entry) => ({ value: entry }));
    expect(result).toBeNull();
  });

  it("resolves entry and applies meta", () => {
    const result = resolveChannelMatchConfig(
      { entry: "hello", matchKey: "k", matchSource: "direct" as const },
      (entry) => ({ value: entry }),
    );
    expect(result).toEqual({ value: "hello", matchKey: "k", matchSource: "direct" });
  });
});
