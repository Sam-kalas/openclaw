import { describe, expect, it } from "vitest";
import { buildDeviceAuthPayload } from "./device-auth.js";

describe("buildDeviceAuthPayload", () => {
  const baseParams = {
    deviceId: "device-123",
    clientId: "cli",
    clientMode: "cli",
    role: "admin",
    scopes: ["chat", "config"],
    signedAtMs: 1700000000000,
  };

  it("builds a v1 payload by default when no nonce is provided", () => {
    const result = buildDeviceAuthPayload(baseParams);
    expect(result).toBe("v1|device-123|cli|cli|admin|chat,config|1700000000000|");
  });

  it("includes token when provided in v1", () => {
    const result = buildDeviceAuthPayload({ ...baseParams, token: "my-token" });
    expect(result).toBe("v1|device-123|cli|cli|admin|chat,config|1700000000000|my-token");
  });

  it("builds a v2 payload when nonce is provided", () => {
    const result = buildDeviceAuthPayload({ ...baseParams, nonce: "abc-nonce" });
    expect(result).toBe("v2|device-123|cli|cli|admin|chat,config|1700000000000||abc-nonce");
  });

  it("builds v2 with both token and nonce", () => {
    const result = buildDeviceAuthPayload({
      ...baseParams,
      token: "my-token",
      nonce: "abc-nonce",
    });
    expect(result).toBe("v2|device-123|cli|cli|admin|chat,config|1700000000000|my-token|abc-nonce");
  });

  it("respects explicit version override", () => {
    const result = buildDeviceAuthPayload({ ...baseParams, version: "v2" });
    expect(result).toBe("v2|device-123|cli|cli|admin|chat,config|1700000000000||");
  });

  it("respects explicit v1 version even with nonce", () => {
    const result = buildDeviceAuthPayload({
      ...baseParams,
      version: "v1",
      nonce: "should-be-ignored",
    });
    // v1 format does not include nonce field
    expect(result).toBe("v1|device-123|cli|cli|admin|chat,config|1700000000000|");
  });

  it("handles empty scopes array", () => {
    const result = buildDeviceAuthPayload({ ...baseParams, scopes: [] });
    expect(result).toBe("v1|device-123|cli|cli|admin||1700000000000|");
  });

  it("handles single scope", () => {
    const result = buildDeviceAuthPayload({ ...baseParams, scopes: ["chat"] });
    expect(result).toBe("v1|device-123|cli|cli|admin|chat|1700000000000|");
  });

  it("handles null token as empty string", () => {
    const result = buildDeviceAuthPayload({ ...baseParams, token: null });
    expect(result).toBe("v1|device-123|cli|cli|admin|chat,config|1700000000000|");
  });

  it("handles null nonce in v2 as empty string", () => {
    const result = buildDeviceAuthPayload({ ...baseParams, version: "v2", nonce: null });
    expect(result).toBe("v2|device-123|cli|cli|admin|chat,config|1700000000000||");
  });
});
