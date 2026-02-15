import type { Message } from "@grammyjs/types";
import { describe, expect, it } from "vitest";
import {
  resolveTelegramForumThreadId,
  resolveTelegramThreadSpec,
  buildTelegramThreadParams,
  buildTypingThreadParams,
  resolveTelegramStreamMode,
  buildTelegramGroupPeerId,
  buildTelegramGroupFrom,
  buildTelegramParentPeer,
  buildSenderName,
  buildSenderLabel,
  buildGroupLabel,
  hasBotMention,
  expandTextLinks,
  resolveTelegramReplyId,
} from "./helpers.js";

describe("resolveTelegramForumThreadId", () => {
  it("returns undefined for non-forum groups", () => {
    expect(resolveTelegramForumThreadId({ isForum: false, messageThreadId: 42 })).toBeUndefined();
  });

  it("returns general topic ID for forum without thread", () => {
    expect(resolveTelegramForumThreadId({ isForum: true })).toBe(1);
  });

  it("returns thread ID for forum with thread", () => {
    expect(resolveTelegramForumThreadId({ isForum: true, messageThreadId: 99 })).toBe(99);
  });
});

describe("resolveTelegramThreadSpec", () => {
  it("returns forum scope for forum groups", () => {
    const spec = resolveTelegramThreadSpec({ isGroup: true, isForum: true, messageThreadId: 5 });
    expect(spec.scope).toBe("forum");
    expect(spec.id).toBe(5);
  });

  it("returns none scope for non-forum groups", () => {
    const spec = resolveTelegramThreadSpec({ isGroup: true, isForum: false, messageThreadId: 5 });
    expect(spec.scope).toBe("none");
    expect(spec.id).toBeUndefined();
  });

  it("returns dm scope for DMs without thread", () => {
    const spec = resolveTelegramThreadSpec({ isGroup: false });
    expect(spec.scope).toBe("dm");
    expect(spec.id).toBeUndefined();
  });

  it("returns dm scope with threadId for DM topics", () => {
    const spec = resolveTelegramThreadSpec({ isGroup: false, messageThreadId: 7 });
    expect(spec.scope).toBe("dm");
    expect(spec.id).toBe(7);
  });
});

describe("buildTelegramThreadParams", () => {
  it("returns undefined for no thread", () => {
    expect(buildTelegramThreadParams(null)).toBeUndefined();
    expect(buildTelegramThreadParams(undefined)).toBeUndefined();
  });

  it("returns undefined for thread without id", () => {
    expect(buildTelegramThreadParams({ scope: "dm" })).toBeUndefined();
  });

  it("returns undefined for general forum topic (id=1)", () => {
    expect(buildTelegramThreadParams({ id: 1, scope: "forum" })).toBeUndefined();
  });

  it("returns message_thread_id for non-general forum topic", () => {
    expect(buildTelegramThreadParams({ id: 42, scope: "forum" })).toEqual({
      message_thread_id: 42,
    });
  });

  it("returns message_thread_id for DM topic", () => {
    expect(buildTelegramThreadParams({ id: 7, scope: "dm" })).toEqual({
      message_thread_id: 7,
    });
  });
});

describe("buildTypingThreadParams", () => {
  it("returns undefined for no thread", () => {
    expect(buildTypingThreadParams(undefined)).toBeUndefined();
  });

  it("returns message_thread_id including for general topic", () => {
    expect(buildTypingThreadParams(1)).toEqual({ message_thread_id: 1 });
    expect(buildTypingThreadParams(42)).toEqual({ message_thread_id: 42 });
  });
});

describe("resolveTelegramStreamMode", () => {
  it("defaults to partial", () => {
    expect(resolveTelegramStreamMode()).toBe("partial");
    expect(resolveTelegramStreamMode({})).toBe("partial");
  });

  it("returns valid modes", () => {
    expect(resolveTelegramStreamMode({ streamMode: "off" })).toBe("off");
    expect(resolveTelegramStreamMode({ streamMode: "block" })).toBe("block");
    expect(resolveTelegramStreamMode({ streamMode: "partial" })).toBe("partial");
  });

  it("handles case-insensitive input", () => {
    expect(resolveTelegramStreamMode({ streamMode: "OFF" as unknown as "off" })).toBe("off");
  });

  it("returns partial for invalid input", () => {
    expect(resolveTelegramStreamMode({ streamMode: "invalid" as unknown as "off" })).toBe(
      "partial",
    );
  });
});

describe("buildTelegramGroupPeerId", () => {
  it("returns chatId as string without topic", () => {
    expect(buildTelegramGroupPeerId(-1001234567890)).toBe("-1001234567890");
  });

  it("appends topic suffix", () => {
    expect(buildTelegramGroupPeerId(-1001234567890, 42)).toBe("-1001234567890:topic:42");
  });
});

describe("buildTelegramGroupFrom", () => {
  it("builds from without topic", () => {
    expect(buildTelegramGroupFrom(123)).toBe("telegram:group:123");
  });

  it("builds from with topic", () => {
    expect(buildTelegramGroupFrom(123, 5)).toBe("telegram:group:123:topic:5");
  });
});

describe("buildTelegramParentPeer", () => {
  it("returns undefined for non-group", () => {
    expect(buildTelegramParentPeer({ isGroup: false, chatId: 123 })).toBeUndefined();
  });

  it("returns undefined for group without topic", () => {
    expect(buildTelegramParentPeer({ isGroup: true, chatId: 123 })).toBeUndefined();
  });

  it("returns parent peer for group with topic", () => {
    expect(
      buildTelegramParentPeer({ isGroup: true, resolvedThreadId: 5, chatId: -100123 }),
    ).toEqual({ kind: "group", id: "-100123" });
  });
});

describe("buildSenderName", () => {
  it("returns combined first+last name", () => {
    const msg = { from: { first_name: "John", last_name: "Doe" } } as Message;
    expect(buildSenderName(msg)).toBe("John Doe");
  });

  it("returns first name only", () => {
    const msg = { from: { first_name: "Alice" } } as Message;
    expect(buildSenderName(msg)).toBe("Alice");
  });

  it("falls back to username", () => {
    const msg = { from: { username: "coolbot" } } as Message;
    expect(buildSenderName(msg)).toBe("coolbot");
  });

  it("returns undefined when no from", () => {
    const msg = {} as Message;
    expect(buildSenderName(msg)).toBeUndefined();
  });
});

describe("buildSenderLabel", () => {
  it("builds label with name and username and id", () => {
    const msg = {
      from: { first_name: "John", username: "johnd", id: 123 },
    } as Message;
    expect(buildSenderLabel(msg, 123)).toBe("John (@johnd) id:123");
  });

  it("falls back to senderId", () => {
    const msg = {} as Message;
    expect(buildSenderLabel(msg, 456)).toBe("id:456");
  });

  it("returns id:unknown when no info", () => {
    const msg = {} as Message;
    expect(buildSenderLabel(msg)).toBe("id:unknown");
  });
});

describe("buildGroupLabel", () => {
  it("uses chat title when available", () => {
    const msg = { chat: { title: "My Group" } } as Message;
    expect(buildGroupLabel(msg, -100123)).toBe("My Group id:-100123");
  });

  it("falls back to group prefix", () => {
    const msg = { chat: {} } as Message;
    expect(buildGroupLabel(msg, -100123)).toBe("group:-100123");
  });

  it("appends topic suffix", () => {
    const msg = { chat: { title: "Group" } } as Message;
    expect(buildGroupLabel(msg, -100, 5)).toBe("Group id:-100 topic:5");
  });
});

describe("expandTextLinks", () => {
  it("returns text unchanged without entities", () => {
    expect(expandTextLinks("hello world", [])).toBe("hello world");
  });

  it("returns text unchanged without text_link entities", () => {
    expect(expandTextLinks("hello @world", [{ type: "mention", offset: 6, length: 6 }])).toBe(
      "hello @world",
    );
  });

  it("expands text_link to markdown", () => {
    const result = expandTextLinks("Click here for info", [
      { type: "text_link", offset: 6, length: 4, url: "https://example.com" },
    ]);
    expect(result).toBe("Click [here](https://example.com) for info");
  });

  it("handles multiple text_links", () => {
    const result = expandTextLinks("A and B", [
      { type: "text_link", offset: 0, length: 1, url: "https://a.com" },
      { type: "text_link", offset: 6, length: 1, url: "https://b.com" },
    ]);
    expect(result).toBe("[A](https://a.com) and [B](https://b.com)");
  });
});

describe("resolveTelegramReplyId", () => {
  it("returns undefined for empty", () => {
    expect(resolveTelegramReplyId(undefined)).toBeUndefined();
    expect(resolveTelegramReplyId("")).toBeUndefined();
  });

  it("parses numeric string", () => {
    expect(resolveTelegramReplyId("42")).toBe(42);
  });

  it("returns undefined for non-numeric", () => {
    expect(resolveTelegramReplyId("abc")).toBeUndefined();
  });
});

describe("hasBotMention", () => {
  it("detects @ mention in text", () => {
    const msg = { text: "Hello @mybot how are you", entities: [] } as unknown as Message;
    expect(hasBotMention(msg, "mybot")).toBe(true);
  });

  it("detects mention entity", () => {
    const msg = {
      text: "Hello @MyBot",
      entities: [{ type: "mention", offset: 6, length: 6 }],
    } as unknown as Message;
    expect(hasBotMention(msg, "mybot")).toBe(true);
  });

  it("returns false when no mention", () => {
    const msg = { text: "Hello world", entities: [] } as unknown as Message;
    expect(hasBotMention(msg, "mybot")).toBe(false);
  });
});
