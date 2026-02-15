import { afterEach, describe, expect, it } from "vitest";
import {
  shouldLogSubsystemToConsole,
  setConsoleSubsystemFilter,
  formatConsoleTimestamp,
} from "./console.js";

afterEach(() => {
  setConsoleSubsystemFilter(null);
});

describe("shouldLogSubsystemToConsole", () => {
  it("returns true when no filter is set", () => {
    setConsoleSubsystemFilter(null);
    expect(shouldLogSubsystemToConsole("anything")).toBe(true);
  });

  it("returns true when filter is empty array", () => {
    setConsoleSubsystemFilter([]);
    expect(shouldLogSubsystemToConsole("anything")).toBe(true);
  });

  it("returns true when subsystem matches filter exactly", () => {
    setConsoleSubsystemFilter(["gateway"]);
    expect(shouldLogSubsystemToConsole("gateway")).toBe(true);
  });

  it("returns true when subsystem starts with filter prefix", () => {
    setConsoleSubsystemFilter(["gateway"]);
    expect(shouldLogSubsystemToConsole("gateway/http")).toBe(true);
  });

  it("returns false when subsystem does not match", () => {
    setConsoleSubsystemFilter(["gateway"]);
    expect(shouldLogSubsystemToConsole("telegram")).toBe(false);
  });

  it("handles multiple filter entries", () => {
    setConsoleSubsystemFilter(["gateway", "telegram"]);
    expect(shouldLogSubsystemToConsole("gateway")).toBe(true);
    expect(shouldLogSubsystemToConsole("telegram")).toBe(true);
    expect(shouldLogSubsystemToConsole("discord")).toBe(false);
  });

  it("does not match partial prefixes without separator", () => {
    setConsoleSubsystemFilter(["gate"]);
    expect(shouldLogSubsystemToConsole("gateway")).toBe(false);
  });
});

describe("setConsoleSubsystemFilter", () => {
  it("clears filter with null", () => {
    setConsoleSubsystemFilter(["gateway"]);
    setConsoleSubsystemFilter(null);
    expect(shouldLogSubsystemToConsole("anything")).toBe(true);
  });

  it("clears filter with empty array", () => {
    setConsoleSubsystemFilter(["gateway"]);
    setConsoleSubsystemFilter([]);
    expect(shouldLogSubsystemToConsole("anything")).toBe(true);
  });

  it("trims filter entries", () => {
    setConsoleSubsystemFilter(["  gateway  "]);
    expect(shouldLogSubsystemToConsole("gateway")).toBe(true);
  });

  it("filters out empty entries after trimming", () => {
    setConsoleSubsystemFilter(["", "  ", "gateway"]);
    expect(shouldLogSubsystemToConsole("gateway")).toBe(true);
  });
});

describe("formatConsoleTimestamp", () => {
  it("returns HH:MM:SS format for pretty style", () => {
    const result = formatConsoleTimestamp("pretty");
    // Should match pattern like "12:34:56"
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("returns ISO-like format for compact style", () => {
    const result = formatConsoleTimestamp("compact");
    // Should match pattern like "2025-01-15T12:34:56.789+00:00"
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  });

  it("returns ISO-like format for json style", () => {
    const result = formatConsoleTimestamp("json");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  });
});
