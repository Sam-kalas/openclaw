import { describe, expect, it } from "vitest";
import { logInboundDrop, logTypingFailure, logAckFailure } from "./logging.js";

describe("logInboundDrop", () => {
  it("formats drop message without target", () => {
    let captured = "";
    logInboundDrop({
      log: (msg) => {
        captured = msg;
      },
      channel: "telegram",
      reason: "no-mention",
    });
    expect(captured).toBe("telegram: drop no-mention");
  });

  it("formats drop message with target", () => {
    let captured = "";
    logInboundDrop({
      log: (msg) => {
        captured = msg;
      },
      channel: "whatsapp",
      reason: "unauthorized",
      target: "user:123",
    });
    expect(captured).toBe("whatsapp: drop unauthorized target=user:123");
  });
});

describe("logTypingFailure", () => {
  it("formats typing failure without target or action", () => {
    let captured = "";
    logTypingFailure({
      log: (msg) => {
        captured = msg;
      },
      channel: "discord",
      error: new Error("network"),
    });
    expect(captured).toBe("discord typing failed: Error: network");
  });

  it("formats typing failure with target and action", () => {
    let captured = "";
    logTypingFailure({
      log: (msg) => {
        captured = msg;
      },
      channel: "telegram",
      target: "chat:456",
      action: "start",
      error: "timeout",
    });
    expect(captured).toBe("telegram typing action=start failed target=chat:456: timeout");
  });
});

describe("logAckFailure", () => {
  it("formats ack failure without target", () => {
    let captured = "";
    logAckFailure({
      log: (msg) => {
        captured = msg;
      },
      channel: "slack",
      error: "api error",
    });
    expect(captured).toBe("slack ack cleanup failed: api error");
  });

  it("formats ack failure with target", () => {
    let captured = "";
    logAckFailure({
      log: (msg) => {
        captured = msg;
      },
      channel: "telegram",
      target: "123/456",
      error: "forbidden",
    });
    expect(captured).toBe("telegram ack cleanup failed target=123/456: forbidden");
  });
});
