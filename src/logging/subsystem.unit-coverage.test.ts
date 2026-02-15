import { describe, expect, it } from "vitest";
import { stripRedundantSubsystemPrefixForConsole } from "./subsystem.js";

describe("stripRedundantSubsystemPrefixForConsole", () => {
  it("returns original message when no subsystem", () => {
    expect(stripRedundantSubsystemPrefixForConsole("hello world", "")).toBe("hello world");
  });

  it("strips bracket-tag prefix that matches subsystem", () => {
    expect(stripRedundantSubsystemPrefixForConsole("[discord] Connected", "discord")).toBe(
      "Connected",
    );
  });

  it("strips bracket-tag prefix case-insensitively", () => {
    expect(stripRedundantSubsystemPrefixForConsole("[Discord] Connected", "discord")).toBe(
      "Connected",
    );
  });

  it("does not strip bracket-tag with different subsystem", () => {
    expect(stripRedundantSubsystemPrefixForConsole("[telegram] Connected", "discord")).toBe(
      "[telegram] Connected",
    );
  });

  it("strips plain prefix that matches subsystem with colon", () => {
    expect(stripRedundantSubsystemPrefixForConsole("discord: Connected to server", "discord")).toBe(
      "Connected to server",
    );
  });

  it("strips plain prefix that matches subsystem with space", () => {
    expect(stripRedundantSubsystemPrefixForConsole("discord  : Connected", "discord")).toBe(
      "Connected",
    );
  });

  it("does not strip partial prefix match", () => {
    expect(stripRedundantSubsystemPrefixForConsole("discordbot: Connected", "discord")).toBe(
      "discordbot: Connected",
    );
  });

  it("handles message with only subsystem prefix and colon", () => {
    expect(stripRedundantSubsystemPrefixForConsole("discord:", "discord")).toBe("");
  });

  it("handles bracket-tag with extra spaces", () => {
    expect(
      stripRedundantSubsystemPrefixForConsole("[discord]   Connected to gateway", "discord"),
    ).toBe("Connected to gateway");
  });

  it("does not strip when bracket is not at start", () => {
    expect(stripRedundantSubsystemPrefixForConsole("hello [discord] world", "discord")).toBe(
      "hello [discord] world",
    );
  });

  it("handles single-char bracket tag", () => {
    expect(stripRedundantSubsystemPrefixForConsole("[d] msg", "d")).toBe("msg");
  });

  it("returns original when bracket is empty", () => {
    expect(stripRedundantSubsystemPrefixForConsole("[] msg", "discord")).toBe("[] msg");
  });
});
