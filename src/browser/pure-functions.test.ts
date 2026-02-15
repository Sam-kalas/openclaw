import { describe, expect, it } from "vitest";
import { appendCdpPath } from "./cdp.helpers.js";
import { parseHttpUrl } from "./config.js";
import {
  isValidProfileName,
  allocateCdpPort,
  getUsedPorts,
  allocateColor,
  getUsedColors,
  PROFILE_COLORS,
  CDP_PORT_RANGE_START,
  CDP_PORT_RANGE_END,
} from "./profiles.js";
import { parseRoleRef, getRoleSnapshotStats } from "./pw-role-snapshot.js";
import { requireRef, normalizeTimeoutMs, toAIFriendlyError } from "./pw-tools-core.shared.js";
import { toStringOrEmpty, toNumber, toBoolean, toStringArray } from "./routes/utils.js";
import { resolveTargetIdFromTabs } from "./target-id.js";

// ---------------------------------------------------------------------------
// profiles.ts
// ---------------------------------------------------------------------------

describe("profiles: isValidProfileName", () => {
  it("accepts lowercase alphanumeric names", () => {
    expect(isValidProfileName("openclaw")).toBe(true);
    expect(isValidProfileName("my-profile")).toBe(true);
    expect(isValidProfileName("a1")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidProfileName("")).toBe(false);
  });

  it("rejects names starting with a hyphen", () => {
    expect(isValidProfileName("-bad")).toBe(false);
  });

  it("rejects names with uppercase letters", () => {
    expect(isValidProfileName("MyProfile")).toBe(false);
  });

  it("rejects names longer than 64 characters", () => {
    expect(isValidProfileName("a".repeat(65))).toBe(false);
  });

  it("accepts names exactly 64 characters", () => {
    expect(isValidProfileName("a".repeat(64))).toBe(true);
  });

  it("rejects names with special characters", () => {
    expect(isValidProfileName("bad_name")).toBe(false);
    expect(isValidProfileName("bad.name")).toBe(false);
    expect(isValidProfileName("bad name")).toBe(false);
  });
});

describe("profiles: allocateCdpPort", () => {
  it("allocates the first port when none are used", () => {
    expect(allocateCdpPort(new Set())).toBe(CDP_PORT_RANGE_START);
  });

  it("skips used ports", () => {
    const used = new Set([CDP_PORT_RANGE_START, CDP_PORT_RANGE_START + 1]);
    expect(allocateCdpPort(used)).toBe(CDP_PORT_RANGE_START + 2);
  });

  it("returns null when all ports are used", () => {
    const used = new Set<number>();
    for (let p = CDP_PORT_RANGE_START; p <= CDP_PORT_RANGE_END; p++) {
      used.add(p);
    }
    expect(allocateCdpPort(used)).toBeNull();
  });

  it("uses a custom range", () => {
    expect(allocateCdpPort(new Set(), { start: 9000, end: 9010 })).toBe(9000);
  });

  it("returns null for invalid range (start > end)", () => {
    expect(allocateCdpPort(new Set(), { start: 9010, end: 9000 })).toBeNull();
  });

  it("returns null for non-finite range values", () => {
    expect(allocateCdpPort(new Set(), { start: NaN, end: 9000 })).toBeNull();
  });
});

describe("profiles: getUsedPorts", () => {
  it("returns empty set for undefined profiles", () => {
    expect(getUsedPorts(undefined)).toEqual(new Set());
  });

  it("collects cdpPort values", () => {
    const ports = getUsedPorts({
      a: { cdpPort: 18800 },
      b: { cdpPort: 18801 },
    });
    expect(ports).toEqual(new Set([18800, 18801]));
  });

  it("extracts port from cdpUrl", () => {
    const ports = getUsedPorts({
      a: { cdpUrl: "http://127.0.0.1:9222" },
    });
    expect(ports).toEqual(new Set([9222]));
  });

  it("defaults to 443 for https URLs without explicit port", () => {
    const ports = getUsedPorts({
      a: { cdpUrl: "https://example.com" },
    });
    expect(ports).toEqual(new Set([443]));
  });

  it("defaults to 80 for http URLs without explicit port", () => {
    const ports = getUsedPorts({
      a: { cdpUrl: "http://example.com" },
    });
    expect(ports).toEqual(new Set([80]));
  });

  it("ignores invalid URLs gracefully", () => {
    const ports = getUsedPorts({
      a: { cdpUrl: "not-a-url" },
    });
    expect(ports).toEqual(new Set());
  });
});

describe("profiles: allocateColor", () => {
  it("returns first palette color when none are used", () => {
    expect(allocateColor(new Set())).toBe(PROFILE_COLORS[0]);
  });

  it("skips used colors", () => {
    const used = new Set([PROFILE_COLORS[0].toUpperCase()]);
    expect(allocateColor(used)).toBe(PROFILE_COLORS[1]);
  });

  it("cycles when all colors are used", () => {
    const used = new Set(PROFILE_COLORS.map((c) => c.toUpperCase()));
    const result = allocateColor(used);
    expect(PROFILE_COLORS).toContain(result);
  });
});

describe("profiles: getUsedColors", () => {
  it("returns empty set for undefined profiles", () => {
    expect(getUsedColors(undefined)).toEqual(new Set());
  });

  it("collects uppercased colors", () => {
    const colors = getUsedColors({
      a: { color: "#ff4500" },
      b: { color: "#0066CC" },
    });
    expect(colors.has("#FF4500")).toBe(true);
    expect(colors.has("#0066CC")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pw-role-snapshot.ts
// ---------------------------------------------------------------------------

describe("pw-role-snapshot: parseRoleRef", () => {
  it("parses bare ref like 'e1'", () => {
    expect(parseRoleRef("e1")).toBe("e1");
  });

  it("parses @-prefixed ref like '@e42'", () => {
    expect(parseRoleRef("@e42")).toBe("e42");
  });

  it("parses ref= prefix like 'ref=e10'", () => {
    expect(parseRoleRef("ref=e10")).toBe("e10");
  });

  it("returns null for empty string", () => {
    expect(parseRoleRef("")).toBeNull();
  });

  it("returns null for non-matching patterns", () => {
    expect(parseRoleRef("button")).toBeNull();
    expect(parseRoleRef("x1")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(parseRoleRef("  e5  ")).toBe("e5");
  });
});

describe("pw-role-snapshot: getRoleSnapshotStats", () => {
  it("counts lines, chars, refs and interactive elements", () => {
    const snapshot = '- button "Click me" [ref=e1]\n- textbox [ref=e2]\n- heading "Title"';
    const refs = {
      e1: { role: "button", name: "Click me" },
      e2: { role: "textbox" },
    };
    const stats = getRoleSnapshotStats(snapshot, refs);
    expect(stats.lines).toBe(3);
    expect(stats.chars).toBe(snapshot.length);
    expect(stats.refs).toBe(2);
    expect(stats.interactive).toBe(2); // button + textbox
  });

  it("returns 0 interactive for non-interactive refs", () => {
    const refs = {
      e1: { role: "heading", name: "Title" },
    };
    const stats = getRoleSnapshotStats("- heading", refs);
    expect(stats.interactive).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// pw-tools-core.shared.ts
// ---------------------------------------------------------------------------

describe("pw-tools-core.shared: normalizeTimeoutMs", () => {
  it("returns value when within range", () => {
    expect(normalizeTimeoutMs(5000, 10000)).toBe(5000);
  });

  it("clamps to minimum of 500ms", () => {
    expect(normalizeTimeoutMs(100, 10000)).toBe(500);
  });

  it("clamps to maximum of 120000ms", () => {
    expect(normalizeTimeoutMs(200_000, 10000)).toBe(120_000);
  });

  it("uses fallback when undefined", () => {
    expect(normalizeTimeoutMs(undefined, 3000)).toBe(3000);
  });
});

describe("pw-tools-core.shared: requireRef", () => {
  it("returns parsed role ref for @e1", () => {
    expect(requireRef("@e1")).toBe("e1");
  });

  it("returns parsed role ref for ref=e5", () => {
    expect(requireRef("ref=e5")).toBe("e5");
  });

  it("strips @ prefix for non-role refs", () => {
    expect(requireRef("@mySelector")).toBe("mySelector");
  });

  it("throws for empty string", () => {
    expect(() => requireRef("")).toThrow("ref is required");
  });

  it("throws for non-string empty values", () => {
    expect(() => requireRef(undefined)).toThrow("ref is required");
    expect(() => requireRef(null)).toThrow("ref is required");
  });
});

describe("pw-tools-core.shared: toAIFriendlyError", () => {
  it("rewrites strict mode violation errors", () => {
    const err = new Error("strict mode violation: resolved to 3 elements");
    const result = toAIFriendlyError(err, "#btn");
    expect(result.message).toContain('Selector "#btn" matched 3 elements');
  });

  it("rewrites timeout/visibility errors", () => {
    const err = new Error("Timeout 5000ms: waiting for element to be visible");
    const result = toAIFriendlyError(err, ".input");
    expect(result.message).toContain('Element ".input" not found or not visible');
  });

  it("rewrites pointer interception errors", () => {
    const err = new Error("Element intercepts pointer events");
    const result = toAIFriendlyError(err, "#overlay");
    expect(result.message).toContain("not interactable");
  });

  it("returns original error for unrecognized messages", () => {
    const err = new Error("something else");
    expect(toAIFriendlyError(err, "x")).toBe(err);
  });

  it("wraps non-Error values", () => {
    const result = toAIFriendlyError("string error", "s");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("string error");
  });
});

// ---------------------------------------------------------------------------
// config.ts: parseHttpUrl
// ---------------------------------------------------------------------------

describe("config: parseHttpUrl", () => {
  it("parses http URL with port", () => {
    const result = parseHttpUrl("http://127.0.0.1:9222", "test");
    expect(result.port).toBe(9222);
    expect(result.normalized).toBe("http://127.0.0.1:9222");
  });

  it("parses https URL defaulting to port 443", () => {
    const result = parseHttpUrl("https://example.com", "test");
    expect(result.port).toBe(443);
  });

  it("parses http URL defaulting to port 80", () => {
    const result = parseHttpUrl("http://example.com", "test");
    expect(result.port).toBe(80);
  });

  it("strips trailing slash from normalized URL", () => {
    const result = parseHttpUrl("http://example.com/", "test");
    expect(result.normalized).toBe("http://example.com");
  });

  it("rejects non-http protocols", () => {
    expect(() => parseHttpUrl("ftp://example.com", "test")).toThrow("must be http(s)");
  });
});

// ---------------------------------------------------------------------------
// cdp.helpers.ts: appendCdpPath edge cases
// ---------------------------------------------------------------------------

describe("cdp.helpers: appendCdpPath edge cases", () => {
  it("handles path without leading slash", () => {
    const url = appendCdpPath("http://127.0.0.1:9222", "json/list");
    expect(url).toBe("http://127.0.0.1:9222/json/list");
  });

  it("handles path with leading slash", () => {
    const url = appendCdpPath("http://127.0.0.1:9222", "/json/version");
    expect(url).toBe("http://127.0.0.1:9222/json/version");
  });

  it("handles base URL with trailing slash", () => {
    const url = appendCdpPath("http://127.0.0.1:9222/", "/json/list");
    expect(url).toBe("http://127.0.0.1:9222/json/list");
  });
});

// ---------------------------------------------------------------------------
// target-id.ts: edge cases
// ---------------------------------------------------------------------------

describe("target-id: edge cases", () => {
  it("returns not_found for empty string input", () => {
    const res = resolveTargetIdFromTabs("", [{ targetId: "ABC" }]);
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns not_found for whitespace-only input", () => {
    const res = resolveTargetIdFromTabs("   ", [{ targetId: "ABC" }]);
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns not_found for empty tabs array", () => {
    const res = resolveTargetIdFromTabs("ABC", []);
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });
});

// ---------------------------------------------------------------------------
// routes/utils.ts
// ---------------------------------------------------------------------------

describe("routes/utils: toStringOrEmpty", () => {
  it("returns trimmed string for string values", () => {
    expect(toStringOrEmpty("  hello  ")).toBe("hello");
  });

  it("converts numbers to string", () => {
    expect(toStringOrEmpty(42)).toBe("42");
  });

  it("converts booleans to string", () => {
    expect(toStringOrEmpty(true)).toBe("true");
  });

  it("returns empty string for null/undefined/objects", () => {
    expect(toStringOrEmpty(null)).toBe("");
    expect(toStringOrEmpty(undefined)).toBe("");
    expect(toStringOrEmpty({})).toBe("");
  });
});

describe("routes/utils: toNumber", () => {
  it("returns number for finite number input", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(3.14)).toBe(3.14);
  });

  it("parses string numbers", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber("3.14")).toBe(3.14);
  });

  it("returns undefined for NaN/Infinity", () => {
    expect(toNumber(NaN)).toBeUndefined();
    expect(toNumber(Infinity)).toBeUndefined();
  });

  it("returns undefined for non-numeric strings", () => {
    expect(toNumber("abc")).toBeUndefined();
    expect(toNumber("")).toBeUndefined();
  });

  it("returns undefined for non-number/string types", () => {
    expect(toNumber(null)).toBeUndefined();
    expect(toNumber(undefined)).toBeUndefined();
  });
});

describe("routes/utils: toBoolean", () => {
  it("returns true for truthy values", () => {
    expect(toBoolean("true")).toBe(true);
    expect(toBoolean("1")).toBe(true);
    expect(toBoolean("yes")).toBe(true);
  });

  it("returns false for falsy values", () => {
    expect(toBoolean("false")).toBe(false);
    expect(toBoolean("0")).toBe(false);
    expect(toBoolean("no")).toBe(false);
  });

  it("returns undefined for unrecognized values", () => {
    expect(toBoolean("maybe")).toBeUndefined();
    expect(toBoolean(null)).toBeUndefined();
  });
});

describe("routes/utils: toStringArray", () => {
  it("returns array of trimmed strings", () => {
    expect(toStringArray(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("filters out empty values", () => {
    expect(toStringArray(["a", "", "c"])).toEqual(["a", "c"]);
  });

  it("returns undefined for non-arrays", () => {
    expect(toStringArray("not-array")).toBeUndefined();
    expect(toStringArray(null)).toBeUndefined();
  });

  it("returns undefined for arrays that become empty after filtering", () => {
    expect(toStringArray(["", ""])).toBeUndefined();
  });

  it("converts non-string elements", () => {
    expect(toStringArray([42, true, "hello"])).toEqual(["42", "true", "hello"]);
  });
});
