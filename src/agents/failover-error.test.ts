import { describe, expect, it } from "vitest";
import {
  FailoverError,
  isFailoverError,
  resolveFailoverStatus,
  isTimeoutError,
  resolveFailoverReasonFromError,
  describeFailoverError,
  coerceToFailoverError,
} from "./failover-error.js";

describe("FailoverError", () => {
  it("creates error with correct properties", () => {
    const err = new FailoverError("test", {
      reason: "rate_limit",
      provider: "anthropic",
      model: "claude-3",
      status: 429,
      code: "rate_limited",
    });
    expect(err.message).toBe("test");
    expect(err.name).toBe("FailoverError");
    expect(err.reason).toBe("rate_limit");
    expect(err.provider).toBe("anthropic");
    expect(err.model).toBe("claude-3");
    expect(err.status).toBe(429);
    expect(err.code).toBe("rate_limited");
  });
});

describe("isFailoverError", () => {
  it("returns true for FailoverError", () => {
    const err = new FailoverError("test", { reason: "auth" });
    expect(isFailoverError(err)).toBe(true);
  });

  it("returns false for regular Error", () => {
    expect(isFailoverError(new Error("test"))).toBe(false);
  });

  it("returns false for non-errors", () => {
    expect(isFailoverError(null)).toBe(false);
    expect(isFailoverError("string")).toBe(false);
    expect(isFailoverError(42)).toBe(false);
  });
});

describe("resolveFailoverStatus", () => {
  it("maps billing to 402", () => {
    expect(resolveFailoverStatus("billing")).toBe(402);
  });

  it("maps rate_limit to 429", () => {
    expect(resolveFailoverStatus("rate_limit")).toBe(429);
  });

  it("maps auth to 401", () => {
    expect(resolveFailoverStatus("auth")).toBe(401);
  });

  it("maps timeout to 408", () => {
    expect(resolveFailoverStatus("timeout")).toBe(408);
  });

  it("maps format to 400", () => {
    expect(resolveFailoverStatus("format")).toBe(400);
  });

  it("returns undefined for unknown reasons", () => {
    expect(resolveFailoverStatus("unknown" as "billing")).toBeUndefined();
  });
});

describe("isTimeoutError", () => {
  it("detects TimeoutError by name", () => {
    const err = new Error("something");
    err.name = "TimeoutError";
    expect(isTimeoutError(err)).toBe(true);
  });

  it("detects timeout by message", () => {
    expect(isTimeoutError(new Error("request timed out"))).toBe(true);
    expect(isTimeoutError(new Error("deadline exceeded"))).toBe(true);
    expect(isTimeoutError(new Error("context deadline exceeded"))).toBe(true);
  });

  it("detects AbortError with abort timeout message", () => {
    const err = new Error("request was aborted");
    err.name = "AbortError";
    expect(isTimeoutError(err)).toBe(true);
  });

  it("returns false for regular errors", () => {
    expect(isTimeoutError(new Error("something else"))).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isTimeoutError(null)).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });

  it("detects timeout via cause", () => {
    const cause = new Error("timeout");
    cause.name = "TimeoutError";
    const err = new Error("aborted");
    err.name = "AbortError";
    Object.assign(err, { cause });
    expect(isTimeoutError(err)).toBe(true);
  });
});

describe("resolveFailoverReasonFromError", () => {
  it("returns reason from FailoverError", () => {
    const err = new FailoverError("test", { reason: "billing" });
    expect(resolveFailoverReasonFromError(err)).toBe("billing");
  });

  it("maps status 402 to billing", () => {
    expect(resolveFailoverReasonFromError({ status: 402 })).toBe("billing");
  });

  it("maps status 429 to rate_limit", () => {
    expect(resolveFailoverReasonFromError({ status: 429 })).toBe("rate_limit");
  });

  it("maps status 401 to auth", () => {
    expect(resolveFailoverReasonFromError({ status: 401 })).toBe("auth");
  });

  it("maps status 403 to auth", () => {
    expect(resolveFailoverReasonFromError({ status: 403 })).toBe("auth");
  });

  it("maps ETIMEDOUT code to timeout", () => {
    const err = Object.assign(new Error("connection"), { code: "ETIMEDOUT" });
    expect(resolveFailoverReasonFromError(err)).toBe("timeout");
  });

  it("maps ECONNRESET code to timeout", () => {
    const err = Object.assign(new Error("reset"), { code: "ECONNRESET" });
    expect(resolveFailoverReasonFromError(err)).toBe("timeout");
  });
});

describe("describeFailoverError", () => {
  it("describes FailoverError", () => {
    const err = new FailoverError("test msg", {
      reason: "auth",
      status: 401,
      code: "unauthorized",
    });
    const desc = describeFailoverError(err);
    expect(desc.message).toBe("test msg");
    expect(desc.reason).toBe("auth");
    expect(desc.status).toBe(401);
    expect(desc.code).toBe("unauthorized");
  });

  it("describes regular error", () => {
    const err = Object.assign(new Error("something failed"), { status: 429 });
    const desc = describeFailoverError(err);
    expect(desc.message).toBe("something failed");
    expect(desc.status).toBe(429);
    expect(desc.reason).toBe("rate_limit");
  });
});

describe("coerceToFailoverError", () => {
  it("returns same FailoverError if already one", () => {
    const err = new FailoverError("test", { reason: "auth" });
    expect(coerceToFailoverError(err)).toBe(err);
  });

  it("creates FailoverError from status-based error", () => {
    const err = Object.assign(new Error("rate limited"), { status: 429 });
    const result = coerceToFailoverError(err, { provider: "anthropic" });
    expect(result).toBeInstanceOf(FailoverError);
    expect(result!.reason).toBe("rate_limit");
    expect(result!.provider).toBe("anthropic");
  });

  it("returns null if no reason can be determined", () => {
    expect(coerceToFailoverError(new Error("generic"))).toBeNull();
  });
});
