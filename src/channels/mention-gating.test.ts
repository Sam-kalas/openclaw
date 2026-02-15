import { describe, expect, it } from "vitest";
import { resolveMentionGating, resolveMentionGatingWithBypass } from "./mention-gating.js";

describe("resolveMentionGating", () => {
  it("skips when requireMention + canDetect + not mentioned", () => {
    const result = resolveMentionGating({
      requireMention: true,
      canDetectMention: true,
      wasMentioned: false,
    });
    expect(result.shouldSkip).toBe(true);
    expect(result.effectiveWasMentioned).toBe(false);
  });

  it("does not skip when mentioned", () => {
    const result = resolveMentionGating({
      requireMention: true,
      canDetectMention: true,
      wasMentioned: true,
    });
    expect(result.shouldSkip).toBe(false);
    expect(result.effectiveWasMentioned).toBe(true);
  });

  it("does not skip when requireMention is false", () => {
    const result = resolveMentionGating({
      requireMention: false,
      canDetectMention: true,
      wasMentioned: false,
    });
    expect(result.shouldSkip).toBe(false);
  });

  it("does not skip when canDetectMention is false", () => {
    const result = resolveMentionGating({
      requireMention: true,
      canDetectMention: false,
      wasMentioned: false,
    });
    expect(result.shouldSkip).toBe(false);
  });

  it("implicit mention makes effectiveWasMentioned true", () => {
    const result = resolveMentionGating({
      requireMention: true,
      canDetectMention: true,
      wasMentioned: false,
      implicitMention: true,
    });
    expect(result.effectiveWasMentioned).toBe(true);
    expect(result.shouldSkip).toBe(false);
  });

  it("bypass makes effectiveWasMentioned true", () => {
    const result = resolveMentionGating({
      requireMention: true,
      canDetectMention: true,
      wasMentioned: false,
      shouldBypassMention: true,
    });
    expect(result.effectiveWasMentioned).toBe(true);
    expect(result.shouldSkip).toBe(false);
  });
});

describe("resolveMentionGatingWithBypass", () => {
  const base = {
    isGroup: true,
    requireMention: true,
    canDetectMention: true,
    wasMentioned: false,
    hasAnyMention: false,
    allowTextCommands: true,
    hasControlCommand: true,
    commandAuthorized: true,
  };

  it("bypasses mention when control command from authorized sender in group", () => {
    const result = resolveMentionGatingWithBypass(base);
    expect(result.shouldBypassMention).toBe(true);
    expect(result.effectiveWasMentioned).toBe(true);
    expect(result.shouldSkip).toBe(false);
  });

  it("does not bypass when not in group", () => {
    const result = resolveMentionGatingWithBypass({ ...base, isGroup: false });
    expect(result.shouldBypassMention).toBe(false);
  });

  it("does not bypass when already mentioned", () => {
    const result = resolveMentionGatingWithBypass({ ...base, wasMentioned: true });
    expect(result.shouldBypassMention).toBe(false);
  });

  it("does not bypass when hasAnyMention is true", () => {
    const result = resolveMentionGatingWithBypass({ ...base, hasAnyMention: true });
    expect(result.shouldBypassMention).toBe(false);
  });

  it("does not bypass when command not authorized", () => {
    const result = resolveMentionGatingWithBypass({ ...base, commandAuthorized: false });
    expect(result.shouldBypassMention).toBe(false);
  });

  it("does not bypass when no control command", () => {
    const result = resolveMentionGatingWithBypass({ ...base, hasControlCommand: false });
    expect(result.shouldBypassMention).toBe(false);
  });

  it("does not bypass when allowTextCommands is false", () => {
    const result = resolveMentionGatingWithBypass({ ...base, allowTextCommands: false });
    expect(result.shouldBypassMention).toBe(false);
  });
});
