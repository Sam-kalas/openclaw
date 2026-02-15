import { describe, expect, it, beforeEach } from "vitest";
import { recordSentMessage, wasSentByBot, clearSentMessageCache } from "./sent-message-cache.js";

describe("sent-message-cache", () => {
  beforeEach(() => {
    clearSentMessageCache();
  });

  it("records and detects sent messages", () => {
    recordSentMessage(123, 1);
    expect(wasSentByBot(123, 1)).toBe(true);
  });

  it("returns false for unknown messages", () => {
    expect(wasSentByBot(123, 999)).toBe(false);
  });

  it("returns false for unknown chats", () => {
    recordSentMessage(123, 1);
    expect(wasSentByBot(456, 1)).toBe(false);
  });

  it("handles string chat IDs", () => {
    recordSentMessage("chat-abc", 42);
    expect(wasSentByBot("chat-abc", 42)).toBe(true);
  });

  it("clears cache", () => {
    recordSentMessage(1, 1);
    clearSentMessageCache();
    expect(wasSentByBot(1, 1)).toBe(false);
  });

  it("tracks multiple messages per chat", () => {
    recordSentMessage(100, 1);
    recordSentMessage(100, 2);
    recordSentMessage(100, 3);
    expect(wasSentByBot(100, 1)).toBe(true);
    expect(wasSentByBot(100, 2)).toBe(true);
    expect(wasSentByBot(100, 3)).toBe(true);
    expect(wasSentByBot(100, 4)).toBe(false);
  });
});
