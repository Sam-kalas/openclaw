import { describe, expect, it, vi } from "vitest";
import type { AuthRateLimiter, RateLimitCheckResult } from "./auth-rate-limit.js";
import {
  assertGatewayAuthConfigured,
  authorizeGatewayConnect,
  isLocalDirectRequest,
  resolveGatewayAuth,
  type GatewayAuthResult,
  type ResolvedGatewayAuth,
} from "./auth.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLimiterSpy(): AuthRateLimiter & {
  check: ReturnType<typeof vi.fn>;
  recordFailure: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
} {
  return {
    check: vi.fn((): RateLimitCheckResult => ({ allowed: true, remaining: 10, retryAfterMs: 0 })),
    recordFailure: vi.fn(),
    reset: vi.fn(),
    size: () => 0,
    prune: () => {},
    dispose: () => {},
  };
}

function fakeReq(opts: {
  remoteAddress?: string;
  headers?: Record<string, string | string[] | undefined>;
}) {
  return {
    socket: { remoteAddress: opts.remoteAddress },
    headers: opts.headers ?? {},
  } as never;
}

// ---------------------------------------------------------------------------
// resolveGatewayAuth
// ---------------------------------------------------------------------------

describe("resolveGatewayAuth", () => {
  it("reads token from authConfig when provided", () => {
    const result = resolveGatewayAuth({
      authConfig: { token: "cfg-token" },
      env: {},
    });
    expect(result.mode).toBe("token");
    expect(result.token).toBe("cfg-token");
  });

  it("falls back to OPENCLAW_GATEWAY_TOKEN env var", () => {
    const result = resolveGatewayAuth({
      authConfig: {},
      env: { OPENCLAW_GATEWAY_TOKEN: "env-token" },
    });
    expect(result.token).toBe("env-token");
  });

  it("falls back to CLAWDBOT_GATEWAY_TOKEN env var", () => {
    const result = resolveGatewayAuth({
      authConfig: {},
      env: { CLAWDBOT_GATEWAY_TOKEN: "legacy-token" },
    });
    expect(result.token).toBe("legacy-token");
  });

  it("prefers authConfig.token over env vars", () => {
    const result = resolveGatewayAuth({
      authConfig: { token: "cfg-token" },
      env: { OPENCLAW_GATEWAY_TOKEN: "env-token", CLAWDBOT_GATEWAY_TOKEN: "legacy-token" },
    });
    expect(result.token).toBe("cfg-token");
  });

  it("reads password from authConfig", () => {
    const result = resolveGatewayAuth({
      authConfig: { password: "cfg-pw" },
      env: {},
    });
    expect(result.password).toBe("cfg-pw");
  });

  it("falls back to OPENCLAW_GATEWAY_PASSWORD env var", () => {
    const result = resolveGatewayAuth({
      authConfig: {},
      env: { OPENCLAW_GATEWAY_PASSWORD: "env-pw" },
    });
    expect(result.password).toBe("env-pw");
  });

  it("falls back to CLAWDBOT_GATEWAY_PASSWORD env var", () => {
    const result = resolveGatewayAuth({
      authConfig: {},
      env: { CLAWDBOT_GATEWAY_PASSWORD: "legacy-pw" },
    });
    expect(result.password).toBe("legacy-pw");
  });

  it("defaults mode to 'token' when no password is set", () => {
    const result = resolveGatewayAuth({ authConfig: {}, env: {} });
    expect(result.mode).toBe("token");
  });

  it("defaults mode to 'password' when password is available and mode is unset", () => {
    const result = resolveGatewayAuth({
      authConfig: { password: "pw" },
      env: {},
    });
    expect(result.mode).toBe("password");
  });

  it("respects explicit mode from authConfig even with password present", () => {
    const result = resolveGatewayAuth({
      authConfig: { mode: "token", password: "pw", token: "tk" },
      env: {},
    });
    expect(result.mode).toBe("token");
  });

  it("enables tailscale when tailscaleMode is 'serve' and mode is not 'password'", () => {
    const result = resolveGatewayAuth({
      authConfig: {},
      env: {},
      tailscaleMode: "serve",
    });
    expect(result.allowTailscale).toBe(true);
  });

  it("disables tailscale when tailscaleMode is 'serve' but mode is 'password'", () => {
    const result = resolveGatewayAuth({
      authConfig: { password: "pw" },
      env: {},
      tailscaleMode: "serve",
    });
    expect(result.allowTailscale).toBe(false);
  });

  it("disables tailscale when tailscaleMode is not 'serve'", () => {
    const result = resolveGatewayAuth({
      authConfig: {},
      env: {},
      tailscaleMode: undefined,
    });
    expect(result.allowTailscale).toBe(false);
  });

  it("respects explicit allowTailscale from authConfig", () => {
    const result = resolveGatewayAuth({
      authConfig: { allowTailscale: true },
      env: {},
    });
    expect(result.allowTailscale).toBe(true);
  });

  it("handles null authConfig gracefully", () => {
    const result = resolveGatewayAuth({ authConfig: null, env: {} });
    expect(result.mode).toBe("token");
    expect(result.token).toBeUndefined();
    expect(result.password).toBeUndefined();
    expect(result.allowTailscale).toBe(false);
  });

  it("handles undefined authConfig gracefully", () => {
    const result = resolveGatewayAuth({ env: {} });
    expect(result.mode).toBe("token");
  });
});

// ---------------------------------------------------------------------------
// assertGatewayAuthConfigured
// ---------------------------------------------------------------------------

describe("assertGatewayAuthConfigured", () => {
  it("does not throw when token mode has a token", () => {
    expect(() =>
      assertGatewayAuthConfigured({ mode: "token", token: "secret", allowTailscale: false }),
    ).not.toThrow();
  });

  it("throws when token mode has no token and tailscale is off", () => {
    expect(() => assertGatewayAuthConfigured({ mode: "token", allowTailscale: false })).toThrow(
      /token/i,
    );
  });

  it("does not throw when token mode has no token but tailscale is on", () => {
    expect(() =>
      assertGatewayAuthConfigured({ mode: "token", allowTailscale: true }),
    ).not.toThrow();
  });

  it("does not throw when password mode has a password", () => {
    expect(() =>
      assertGatewayAuthConfigured({
        mode: "password",
        password: "secret",
        allowTailscale: false,
      }),
    ).not.toThrow();
  });

  it("throws when password mode has no password", () => {
    expect(() => assertGatewayAuthConfigured({ mode: "password", allowTailscale: false })).toThrow(
      /password/i,
    );
  });
});

// ---------------------------------------------------------------------------
// isLocalDirectRequest
// ---------------------------------------------------------------------------

describe("isLocalDirectRequest", () => {
  it("returns false when req is undefined", () => {
    expect(isLocalDirectRequest(undefined)).toBe(false);
  });

  it("returns true for localhost request with loopback remote", () => {
    const req = fakeReq({
      remoteAddress: "127.0.0.1",
      headers: { host: "localhost:18789" },
    });
    expect(isLocalDirectRequest(req)).toBe(true);
  });

  it("returns true for 127.0.0.1 host header", () => {
    const req = fakeReq({
      remoteAddress: "127.0.0.1",
      headers: { host: "127.0.0.1:18789" },
    });
    expect(isLocalDirectRequest(req)).toBe(true);
  });

  it("returns true for ::1 host header with IPv6 loopback remote", () => {
    const req = fakeReq({
      remoteAddress: "::1",
      headers: { host: "[::1]:18789" },
    });
    expect(isLocalDirectRequest(req)).toBe(true);
  });

  it("returns true for .ts.net host with loopback remote", () => {
    const req = fakeReq({
      remoteAddress: "127.0.0.1",
      headers: { host: "myhost.tailnet-abc.ts.net:443" },
    });
    expect(isLocalDirectRequest(req)).toBe(true);
  });

  it("returns false for non-loopback remote address", () => {
    const req = fakeReq({
      remoteAddress: "203.0.113.10",
      headers: { host: "localhost:18789" },
    });
    expect(isLocalDirectRequest(req)).toBe(false);
  });

  it("returns false for non-local host with loopback remote", () => {
    const req = fakeReq({
      remoteAddress: "127.0.0.1",
      headers: { host: "public.example.com:18789" },
    });
    expect(isLocalDirectRequest(req)).toBe(false);
  });

  it("returns false when forwarded headers present without trusted proxy", () => {
    const req = fakeReq({
      remoteAddress: "127.0.0.1",
      headers: {
        host: "localhost:18789",
        "x-forwarded-for": "203.0.113.10",
      },
    });
    expect(isLocalDirectRequest(req)).toBe(false);
  });

  it("returns true when forwarded headers present from trusted proxy", () => {
    const req = fakeReq({
      remoteAddress: "127.0.0.1",
      headers: {
        host: "localhost:18789",
        "x-forwarded-for": "127.0.0.2",
      },
    });
    expect(isLocalDirectRequest(req, ["127.0.0.1"])).toBe(true);
  });

  it("returns false when x-real-ip header is present without trusted proxy", () => {
    const req = fakeReq({
      remoteAddress: "127.0.0.1",
      headers: {
        host: "localhost:18789",
        "x-real-ip": "203.0.113.10",
      },
    });
    expect(isLocalDirectRequest(req)).toBe(false);
  });

  it("returns false when x-forwarded-host header is present without trusted proxy", () => {
    const req = fakeReq({
      remoteAddress: "127.0.0.1",
      headers: {
        host: "localhost:18789",
        "x-forwarded-host": "public.example.com",
      },
    });
    expect(isLocalDirectRequest(req)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// authorizeGatewayConnect — extended scenarios
// ---------------------------------------------------------------------------

describe("authorizeGatewayConnect — extended", () => {
  // --- Token auth ---

  it("succeeds with correct token", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "my-secret", allowTailscale: false },
      connectAuth: { token: "my-secret" },
    });
    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });

  it("fails with incorrect token", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "my-secret", allowTailscale: false },
      connectAuth: { token: "not-my-secret" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("token_mismatch");
  });

  it("fails when no connectAuth token supplied", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "my-secret", allowTailscale: false },
      connectAuth: {},
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("token_missing");
  });

  it("fails when connectAuth is null", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "my-secret", allowTailscale: false },
      connectAuth: null,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("token_missing");
  });

  it("fails when server token is not configured", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", allowTailscale: false },
      connectAuth: { token: "any" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("token_missing_config");
  });

  // --- Password auth ---

  it("succeeds with correct password", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "password", password: "hunter2", allowTailscale: false },
      connectAuth: { password: "hunter2" },
    });
    expect(res.ok).toBe(true);
    expect(res.method).toBe("password");
  });

  it("fails with incorrect password", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "password", password: "hunter2", allowTailscale: false },
      connectAuth: { password: "wrong" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("password_mismatch");
  });

  it("fails when no password supplied in connectAuth", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "password", password: "hunter2", allowTailscale: false },
      connectAuth: {},
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("password_missing");
  });

  it("fails when server password not configured", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "password", allowTailscale: false },
      connectAuth: { password: "any" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("password_missing_config");
  });

  // --- Unknown mode fallback ---

  it("returns unauthorized for unknown auth mode", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "unknown" as never, allowTailscale: false },
      connectAuth: null,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("unauthorized");
  });

  // --- Rate-limiter integration ---

  it("blocks requests when rate-limiter denies", async () => {
    const limiter = createLimiterSpy();
    limiter.check.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 5000 });

    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "secret" },
      rateLimiter: limiter,
    });

    expect(res.ok).toBe(false);
    expect(res.rateLimited).toBe(true);
    expect(res.retryAfterMs).toBe(5000);
    expect(res.reason).toBe("rate_limited");
  });

  it("records failure on token mismatch when rate-limiter present", async () => {
    const limiter = createLimiterSpy();
    await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "wrong" },
      rateLimiter: limiter,
      clientIp: "10.0.0.1",
    });

    expect(limiter.recordFailure).toHaveBeenCalledWith("10.0.0.1", "shared-secret");
  });

  it("records failure on password mismatch when rate-limiter present", async () => {
    const limiter = createLimiterSpy();
    await authorizeGatewayConnect({
      auth: { mode: "password", password: "secret", allowTailscale: false },
      connectAuth: { password: "wrong" },
      rateLimiter: limiter,
      clientIp: "10.0.0.2",
    });

    expect(limiter.recordFailure).toHaveBeenCalledWith("10.0.0.2", "shared-secret");
  });

  it("resets rate-limiter on successful token auth", async () => {
    const limiter = createLimiterSpy();
    await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "secret" },
      rateLimiter: limiter,
      clientIp: "10.0.0.3",
    });

    expect(limiter.reset).toHaveBeenCalledWith("10.0.0.3", "shared-secret");
  });

  it("resets rate-limiter on successful password auth", async () => {
    const limiter = createLimiterSpy();
    await authorizeGatewayConnect({
      auth: { mode: "password", password: "secret", allowTailscale: false },
      connectAuth: { password: "secret" },
      rateLimiter: limiter,
      clientIp: "10.0.0.4",
    });

    expect(limiter.reset).toHaveBeenCalledWith("10.0.0.4", "shared-secret");
  });

  it("records failure on missing token when rate-limiter present", async () => {
    const limiter = createLimiterSpy();
    await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: null,
      rateLimiter: limiter,
      clientIp: "10.0.0.5",
    });

    expect(limiter.recordFailure).toHaveBeenCalledWith("10.0.0.5", "shared-secret");
  });

  it("records failure for unknown mode fallback", async () => {
    const limiter = createLimiterSpy();
    await authorizeGatewayConnect({
      auth: { mode: "unknown" as never, allowTailscale: false },
      connectAuth: null,
      rateLimiter: limiter,
      clientIp: "10.0.0.6",
    });

    expect(limiter.recordFailure).toHaveBeenCalledWith("10.0.0.6", "shared-secret");
  });

  it("uses explicit clientIp for rate-limiter instead of resolving from req", async () => {
    const limiter = createLimiterSpy();
    await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "secret" },
      rateLimiter: limiter,
      clientIp: "explicit-ip",
      req: fakeReq({
        remoteAddress: "should-not-be-used",
        headers: {},
      }),
    });

    expect(limiter.check).toHaveBeenCalledWith("explicit-ip", "shared-secret");
    expect(limiter.reset).toHaveBeenCalledWith("explicit-ip", "shared-secret");
  });

  // --- Tailscale auth scenarios ---

  it("skips tailscale when allowTailscale is false", async () => {
    const tailscaleWhois = vi.fn();
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "secret" },
      tailscaleWhois,
      req: fakeReq({
        remoteAddress: "127.0.0.1",
        headers: {
          "x-forwarded-for": "100.64.0.1",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "test.ts.net",
          "tailscale-user-login": "alice",
        },
      }),
    });

    // Should succeed via token, not tailscale
    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
    expect(tailscaleWhois).not.toHaveBeenCalled();
  });

  it("falls back to token auth when tailscale verification fails", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: true },
      connectAuth: { token: "secret" },
      tailscaleWhois: async () => null, // whois fails
      req: fakeReq({
        remoteAddress: "127.0.0.1",
        headers: {
          "x-forwarded-for": "100.64.0.1",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "test.ts.net",
          "tailscale-user-login": "alice",
        },
      }),
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });

  it("fails tailscale when user-login header missing", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: undefined, allowTailscale: true },
      connectAuth: null,
      tailscaleWhois: async () => ({ login: "alice", name: "Alice" }),
      req: fakeReq({
        remoteAddress: "127.0.0.1",
        headers: {
          "x-forwarded-for": "100.64.0.1",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "test.ts.net",
          // no tailscale-user-login header
        },
      }),
    });

    // Falls through to token check, which fails (no token configured)
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("token_missing_config");
  });

  it("fails tailscale when whois login does not match header login", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: undefined, allowTailscale: true },
      connectAuth: null,
      tailscaleWhois: async () => ({ login: "bob", name: "Bob" }),
      req: fakeReq({
        remoteAddress: "127.0.0.1",
        headers: {
          "x-forwarded-for": "100.64.0.1",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "test.ts.net",
          "tailscale-user-login": "alice",
          "tailscale-user-name": "Alice",
        },
      }),
    });

    // Tailscale fails (mismatch) → falls through to token → token_missing_config
    expect(res.ok).toBe(false);
  });

  it("succeeds tailscale with case-insensitive login matching", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: true },
      connectAuth: null,
      tailscaleWhois: async () => ({ login: "Alice@Example.com", name: "Alice" }),
      req: fakeReq({
        remoteAddress: "127.0.0.1",
        headers: {
          host: "gateway.local",
          "x-forwarded-for": "100.64.0.1",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "ai.ts.net",
          "tailscale-user-login": "alice@example.com",
          "tailscale-user-name": "Alice",
        },
      }),
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("tailscale");
  });

  it("resets rate-limiter on successful tailscale auth", async () => {
    const limiter = createLimiterSpy();
    await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: true },
      connectAuth: null,
      tailscaleWhois: async () => ({ login: "peter", name: "Peter" }),
      req: fakeReq({
        remoteAddress: "127.0.0.1",
        headers: {
          host: "gateway.local",
          "x-forwarded-for": "100.64.0.1",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "ai.ts.net",
          "tailscale-user-login": "peter",
          "tailscale-user-name": "Peter",
        },
      }),
      rateLimiter: limiter,
      clientIp: "100.64.0.1",
    });

    expect(limiter.reset).toHaveBeenCalledWith("100.64.0.1", "shared-secret");
  });

  // --- Edge: no req object ---

  it("succeeds with token auth when req is undefined", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "secret" },
    });
    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });

  it("succeeds with password auth when req is undefined", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "password", password: "secret", allowTailscale: false },
      connectAuth: { password: "secret" },
    });
    expect(res.ok).toBe(true);
    expect(res.method).toBe("password");
  });
});
