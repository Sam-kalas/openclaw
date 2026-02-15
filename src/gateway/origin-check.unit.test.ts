import { describe, expect, it } from "vitest";
import { checkBrowserOrigin } from "./origin-check.js";

describe("checkBrowserOrigin — extended", () => {
  // --- Same-origin scenarios ---

  it("accepts origin matching request host exactly", () => {
    expect(
      checkBrowserOrigin({
        requestHost: "gateway.example.com:18789",
        origin: "http://gateway.example.com:18789",
      }).ok,
    ).toBe(true);
  });

  it("accepts origin matching request host with https (default port stripped)", () => {
    // URL constructor normalizes https://host:443 → host omits port
    expect(
      checkBrowserOrigin({
        requestHost: "gateway.example.com",
        origin: "https://gateway.example.com",
      }).ok,
    ).toBe(true);
  });

  // --- Loopback scenarios ---

  it("accepts loopback-to-loopback with different ports", () => {
    expect(
      checkBrowserOrigin({
        requestHost: "127.0.0.1:18789",
        origin: "http://127.0.0.1:3000",
      }).ok,
    ).toBe(true);
  });

  it("accepts localhost-to-127.0.0.1 cross-origin", () => {
    expect(
      checkBrowserOrigin({
        requestHost: "localhost:18789",
        origin: "http://127.0.0.1:5173",
      }).ok,
    ).toBe(true);
  });

  it("accepts [::1] request host with localhost origin", () => {
    expect(
      checkBrowserOrigin({
        requestHost: "[::1]:18789",
        origin: "http://localhost:5173",
      }).ok,
    ).toBe(true);
  });

  // --- Allowlist scenarios ---

  it("accepts allowlisted origin with different case", () => {
    expect(
      checkBrowserOrigin({
        requestHost: "gateway.example.com",
        origin: "HTTPS://Control.Example.Com",
        allowedOrigins: ["https://control.example.com"],
      }).ok,
    ).toBe(true);
  });

  it("rejects origin not in allowlist", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com",
      origin: "https://attacker.example.com",
      allowedOrigins: ["https://control.example.com"],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts one of multiple allowlisted origins", () => {
    expect(
      checkBrowserOrigin({
        requestHost: "gateway.example.com",
        origin: "https://second.example.com",
        allowedOrigins: ["https://first.example.com", "https://second.example.com"],
      }).ok,
    ).toBe(true);
  });

  // --- Missing/invalid origin ---

  it("rejects undefined origin", () => {
    expect(
      checkBrowserOrigin({
        requestHost: "127.0.0.1:18789",
        origin: undefined,
      }).ok,
    ).toBe(false);
  });

  it("rejects 'null' string origin (sandboxed iframe)", () => {
    expect(
      checkBrowserOrigin({
        requestHost: "127.0.0.1:18789",
        origin: "null",
      }).ok,
    ).toBe(false);
  });

  it("rejects malformed origin URL", () => {
    expect(
      checkBrowserOrigin({
        requestHost: "127.0.0.1:18789",
        origin: "not-a-valid-url",
      }).ok,
    ).toBe(false);
  });

  // --- Non-loopback mismatch ---

  it("rejects non-loopback host mismatch", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      origin: "https://attacker.evil.com",
    });
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("reason");
  });

  it("rejects origin with mismatched host and no allowlist", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com",
      origin: "https://other.example.com",
    });
    expect(result.ok).toBe(false);
  });

  // --- Edge cases ---

  it("handles empty allowedOrigins array", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com",
      origin: "https://attacker.example.com",
      allowedOrigins: [],
    });
    expect(result.ok).toBe(false);
  });

  it("handles whitespace in allowedOrigins", () => {
    expect(
      checkBrowserOrigin({
        requestHost: "gateway.example.com",
        origin: "https://control.example.com",
        allowedOrigins: ["  https://control.example.com  "],
      }).ok,
    ).toBe(true);
  });

  it("handles empty requestHost", () => {
    // Should still work if origin is in the allowlist
    expect(
      checkBrowserOrigin({
        requestHost: "",
        origin: "https://control.example.com",
        allowedOrigins: ["https://control.example.com"],
      }).ok,
    ).toBe(true);
  });
});
