import { describe, expect, it } from "vitest";
import { CHANNEL_MESSAGE_ACTION_NAMES } from "./message-action-names.js";

describe("CHANNEL_MESSAGE_ACTION_NAMES", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(CHANNEL_MESSAGE_ACTION_NAMES)).toBe(true);
    expect(CHANNEL_MESSAGE_ACTION_NAMES.length).toBeGreaterThan(0);
  });

  it("contains standard messaging actions", () => {
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("send");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("broadcast");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("reply");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("edit");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("delete");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("read");
  });

  it("contains poll and react actions", () => {
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("poll");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("react");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("reactions");
  });

  it("contains thread actions", () => {
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("thread-create");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("thread-list");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("thread-reply");
  });

  it("contains channel management actions", () => {
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("channel-info");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("channel-list");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("channel-create");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("channel-edit");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("channel-delete");
  });

  it("contains moderation actions", () => {
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("timeout");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("kick");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("ban");
  });

  it("contains pin actions", () => {
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("pin");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("unpin");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("list-pins");
  });

  it("contains search action", () => {
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("search");
  });

  it("contains sticker actions", () => {
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("sticker");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("sticker-search");
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("sticker-upload");
  });

  it("contains set-presence action", () => {
    expect(CHANNEL_MESSAGE_ACTION_NAMES).toContain("set-presence");
  });

  it("has no duplicate entries", () => {
    const unique = new Set(CHANNEL_MESSAGE_ACTION_NAMES);
    expect(unique.size).toBe(CHANNEL_MESSAGE_ACTION_NAMES.length);
  });
});
