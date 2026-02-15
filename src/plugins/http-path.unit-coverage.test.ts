import { describe, expect, it } from "vitest";
import { normalizePluginHttpPath } from "./http-path.js";

describe("normalizePluginHttpPath", () => {
  it("returns null when path is undefined and no fallback", () => {
    expect(normalizePluginHttpPath(undefined)).toBeNull();
  });

  it("returns null when path is null and no fallback", () => {
    expect(normalizePluginHttpPath(null)).toBeNull();
  });

  it("returns null when path is empty string and no fallback", () => {
    expect(normalizePluginHttpPath("")).toBeNull();
  });

  it("returns null when path is whitespace and no fallback", () => {
    expect(normalizePluginHttpPath("   ")).toBeNull();
  });

  it("returns path with leading slash if already present", () => {
    expect(normalizePluginHttpPath("/api/test")).toBe("/api/test");
  });

  it("prepends slash if missing", () => {
    expect(normalizePluginHttpPath("api/test")).toBe("/api/test");
  });

  it("trims whitespace from path", () => {
    expect(normalizePluginHttpPath("  /api/test  ")).toBe("/api/test");
  });

  it("uses fallback when path is empty", () => {
    expect(normalizePluginHttpPath("", "/fallback")).toBe("/fallback");
  });

  it("prepends slash to fallback if missing", () => {
    expect(normalizePluginHttpPath("", "fallback")).toBe("/fallback");
  });

  it("returns null when both path and fallback are empty", () => {
    expect(normalizePluginHttpPath("", "")).toBeNull();
  });

  it("trims whitespace from fallback", () => {
    expect(normalizePluginHttpPath("", "  /fallback  ")).toBe("/fallback");
  });

  it("ignores fallback when path is provided", () => {
    expect(normalizePluginHttpPath("/main", "/fallback")).toBe("/main");
  });
});
