import { describe, expect, it } from "vitest";
import {
  resolveCommandAuthorizedFromAuthorizers,
  resolveControlCommandGate,
} from "./command-gating.js";

describe("resolveCommandAuthorizedFromAuthorizers", () => {
  it("returns true when useAccessGroups off and default mode", () => {
    expect(
      resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups: false,
        authorizers: [],
      }),
    ).toBe(true);
  });

  it("returns false when useAccessGroups off and mode=deny", () => {
    expect(
      resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups: false,
        authorizers: [],
        modeWhenAccessGroupsOff: "deny",
      }),
    ).toBe(false);
  });

  it("checks configured authorizers when mode=configured and access groups off", () => {
    expect(
      resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups: false,
        authorizers: [{ configured: true, allowed: true }],
        modeWhenAccessGroupsOff: "configured",
      }),
    ).toBe(true);

    expect(
      resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups: false,
        authorizers: [{ configured: true, allowed: false }],
        modeWhenAccessGroupsOff: "configured",
      }),
    ).toBe(false);
  });

  it("allows when no authorizers are configured (mode=configured)", () => {
    expect(
      resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups: false,
        authorizers: [{ configured: false, allowed: false }],
        modeWhenAccessGroupsOff: "configured",
      }),
    ).toBe(true);
  });

  it("uses access groups when enabled", () => {
    expect(
      resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups: true,
        authorizers: [{ configured: true, allowed: true }],
      }),
    ).toBe(true);

    expect(
      resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups: true,
        authorizers: [{ configured: true, allowed: false }],
      }),
    ).toBe(false);

    expect(
      resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups: true,
        authorizers: [{ configured: false, allowed: false }],
      }),
    ).toBe(false);
  });
});

describe("resolveControlCommandGate", () => {
  it("does not block when commandAuthorized is true", () => {
    const result = resolveControlCommandGate({
      useAccessGroups: false,
      authorizers: [],
      allowTextCommands: true,
      hasControlCommand: true,
    });
    expect(result.commandAuthorized).toBe(true);
    expect(result.shouldBlock).toBe(false);
  });

  it("blocks unauthorized control commands", () => {
    const result = resolveControlCommandGate({
      useAccessGroups: true,
      authorizers: [{ configured: true, allowed: false }],
      allowTextCommands: true,
      hasControlCommand: true,
    });
    expect(result.commandAuthorized).toBe(false);
    expect(result.shouldBlock).toBe(true);
  });

  it("does not block when no control command present", () => {
    const result = resolveControlCommandGate({
      useAccessGroups: true,
      authorizers: [{ configured: true, allowed: false }],
      allowTextCommands: true,
      hasControlCommand: false,
    });
    expect(result.commandAuthorized).toBe(false);
    expect(result.shouldBlock).toBe(false);
  });

  it("does not block when allowTextCommands is false", () => {
    const result = resolveControlCommandGate({
      useAccessGroups: true,
      authorizers: [{ configured: true, allowed: false }],
      allowTextCommands: false,
      hasControlCommand: true,
    });
    expect(result.shouldBlock).toBe(false);
  });
});
