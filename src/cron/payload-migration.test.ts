import { describe, expect, it } from "vitest";
import { migrateLegacyCronPayload } from "./payload-migration.js";

describe("migrateLegacyCronPayload", () => {
  it("replaces provider with channel", () => {
    const payload: Record<string, unknown> = {
      kind: "agentTurn",
      message: "hello",
      provider: "telegram",
    };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect(payload.channel).toBe("telegram");
    expect("provider" in payload).toBe(false);
  });

  it("normalizes channel casing", () => {
    const payload: Record<string, unknown> = {
      kind: "agentTurn",
      message: "hello",
      provider: " TeLeGrAm ",
    };
    migrateLegacyCronPayload(payload);
    expect(payload.channel).toBe("telegram");
  });

  it("prefers existing channel over provider", () => {
    const payload: Record<string, unknown> = {
      kind: "agentTurn",
      message: "hello",
      channel: "discord",
      provider: "telegram",
    };
    migrateLegacyCronPayload(payload);
    expect(payload.channel).toBe("discord");
    expect("provider" in payload).toBe(false);
  });

  it("normalizes existing channel casing", () => {
    const payload: Record<string, unknown> = {
      kind: "agentTurn",
      message: "hello",
      channel: " Discord ",
    };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect(payload.channel).toBe("discord");
  });

  it("returns false when no provider exists and channel is already normalized", () => {
    const payload: Record<string, unknown> = {
      kind: "agentTurn",
      message: "hello",
      channel: "telegram",
    };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(false);
  });

  it("removes provider even when empty", () => {
    const payload: Record<string, unknown> = {
      kind: "agentTurn",
      message: "hello",
      provider: "",
    };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect("provider" in payload).toBe(false);
  });

  it("handles payload with no channel and no provider", () => {
    const payload: Record<string, unknown> = {
      kind: "agentTurn",
      message: "hello",
    };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(false);
  });

  it("handles non-string provider values gracefully", () => {
    const payload: Record<string, unknown> = {
      kind: "agentTurn",
      message: "hello",
      provider: 123,
    };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true); // provider key removed
    expect("provider" in payload).toBe(false);
  });
});
