import { describe, expect, it } from "vitest";
import {
  actionRequiresTarget,
  actionHasTarget,
  MESSAGE_ACTION_TARGET_MODE,
} from "./message-action-spec.js";

describe("actionRequiresTarget", () => {
  it("returns true for send", () => {
    expect(actionRequiresTarget("send")).toBe(true);
  });

  it("returns true for reply", () => {
    expect(actionRequiresTarget("reply")).toBe(true);
  });

  it("returns true for react", () => {
    expect(actionRequiresTarget("react")).toBe(true);
  });

  it("returns false for broadcast", () => {
    expect(actionRequiresTarget("broadcast")).toBe(false);
  });

  it("returns false for search", () => {
    expect(actionRequiresTarget("search")).toBe(false);
  });

  it("returns false for thread-list", () => {
    expect(actionRequiresTarget("thread-list")).toBe(false);
  });

  it("returns true for channel-info (channelId mode)", () => {
    expect(actionRequiresTarget("channel-info")).toBe(true);
  });

  it("returns false for channel-list", () => {
    expect(actionRequiresTarget("channel-list")).toBe(false);
  });

  it("returns false for set-presence", () => {
    expect(actionRequiresTarget("set-presence")).toBe(false);
  });
});

describe("actionHasTarget", () => {
  it("returns true when to is set", () => {
    expect(actionHasTarget("send", { to: "#general" })).toBe(true);
  });

  it("returns true when channelId is set", () => {
    expect(actionHasTarget("channel-info", { channelId: "123" })).toBe(true);
  });

  it("returns false when no target fields set", () => {
    expect(actionHasTarget("send", {})).toBe(false);
  });

  it("returns false for empty to string", () => {
    expect(actionHasTarget("send", { to: "  " })).toBe(false);
  });

  it("detects alias targets for unsend (messageId)", () => {
    expect(actionHasTarget("unsend", { messageId: "abc123" })).toBe(true);
  });

  it("detects alias targets for react (chatGuid)", () => {
    expect(actionHasTarget("react", { chatGuid: "chat123" })).toBe(true);
  });

  it("detects alias targets for react (chatId)", () => {
    expect(actionHasTarget("react", { chatId: "chat456" })).toBe(true);
  });

  it("detects numeric alias targets", () => {
    expect(actionHasTarget("unsend", { messageId: 12345 })).toBe(true);
  });

  it("returns false for actions without aliases and no to/channelId", () => {
    expect(actionHasTarget("send", { messageId: "abc" })).toBe(false);
  });
});

describe("MESSAGE_ACTION_TARGET_MODE", () => {
  it("has entries for all standard actions", () => {
    expect(MESSAGE_ACTION_TARGET_MODE.send).toBe("to");
    expect(MESSAGE_ACTION_TARGET_MODE.broadcast).toBe("none");
    expect(MESSAGE_ACTION_TARGET_MODE["channel-info"]).toBe("channelId");
  });
});
