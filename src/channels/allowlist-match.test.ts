import { describe, expect, it } from "vitest";
import { formatAllowlistMatchMeta } from "./allowlist-match.js";

describe("formatAllowlistMatchMeta", () => {
  it("formats when match has key and source", () => {
    expect(formatAllowlistMatchMeta({ matchKey: "user:123", matchSource: "id" })).toBe(
      "matchKey=user:123 matchSource=id",
    );
  });

  it("formats with none when match is null", () => {
    expect(formatAllowlistMatchMeta(null)).toBe("matchKey=none matchSource=none");
  });

  it("formats with none when match is undefined", () => {
    expect(formatAllowlistMatchMeta(undefined)).toBe("matchKey=none matchSource=none");
  });

  it("formats with none for missing keys", () => {
    expect(formatAllowlistMatchMeta({})).toBe("matchKey=none matchSource=none");
  });

  it("formats with partial values", () => {
    expect(formatAllowlistMatchMeta({ matchKey: "foo" })).toBe("matchKey=foo matchSource=none");
  });
});
