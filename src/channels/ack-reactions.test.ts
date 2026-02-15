import { describe, expect, it } from "vitest";
import { shouldAckReaction, shouldAckReactionForWhatsApp } from "./ack-reactions.js";

describe("shouldAckReaction", () => {
  const base = {
    isDirect: false,
    isGroup: true,
    isMentionableGroup: true,
    requireMention: true,
    canDetectMention: true,
    effectiveWasMentioned: true,
  };

  it("returns false for scope=off", () => {
    expect(shouldAckReaction({ ...base, scope: "off" })).toBe(false);
  });

  it("returns false for scope=none", () => {
    expect(shouldAckReaction({ ...base, scope: "none" })).toBe(false);
  });

  it("returns true for scope=all", () => {
    expect(shouldAckReaction({ ...base, scope: "all" })).toBe(true);
  });

  it("returns true for scope=direct when isDirect", () => {
    expect(shouldAckReaction({ ...base, scope: "direct", isDirect: true })).toBe(true);
  });

  it("returns false for scope=direct when not isDirect", () => {
    expect(shouldAckReaction({ ...base, scope: "direct", isDirect: false })).toBe(false);
  });

  it("returns true for scope=group-all when isGroup", () => {
    expect(shouldAckReaction({ ...base, scope: "group-all", isGroup: true })).toBe(true);
  });

  it("returns false for scope=group-all when not isGroup", () => {
    expect(shouldAckReaction({ ...base, scope: "group-all", isGroup: false })).toBe(false);
  });

  it("returns true for scope=group-mentions when all conditions met", () => {
    expect(shouldAckReaction({ ...base, scope: "group-mentions" })).toBe(true);
  });

  it("returns false for scope=group-mentions when not mentionable", () => {
    expect(shouldAckReaction({ ...base, scope: "group-mentions", isMentionableGroup: false })).toBe(
      false,
    );
  });

  it("returns false for scope=group-mentions when requireMention is false", () => {
    expect(shouldAckReaction({ ...base, scope: "group-mentions", requireMention: false })).toBe(
      false,
    );
  });

  it("returns false for scope=group-mentions when canDetectMention is false", () => {
    expect(shouldAckReaction({ ...base, scope: "group-mentions", canDetectMention: false })).toBe(
      false,
    );
  });

  it("returns false for scope=group-mentions when not mentioned", () => {
    expect(
      shouldAckReaction({ ...base, scope: "group-mentions", effectiveWasMentioned: false }),
    ).toBe(false);
  });

  it("returns true for scope=group-mentions with bypass", () => {
    expect(
      shouldAckReaction({
        ...base,
        scope: "group-mentions",
        effectiveWasMentioned: false,
        shouldBypassMention: true,
      }),
    ).toBe(true);
  });

  it("defaults to group-mentions when scope is undefined", () => {
    expect(shouldAckReaction({ ...base, scope: undefined })).toBe(true);
  });
});

describe("shouldAckReactionForWhatsApp", () => {
  const base = {
    emoji: "👍",
    isDirect: false,
    isGroup: true,
    directEnabled: true,
    groupMode: "mentions" as const,
    wasMentioned: true,
    groupActivated: false,
  };

  it("returns false when no emoji", () => {
    expect(shouldAckReactionForWhatsApp({ ...base, emoji: "" })).toBe(false);
  });

  it("returns true for direct when directEnabled", () => {
    expect(shouldAckReactionForWhatsApp({ ...base, isDirect: true, isGroup: false })).toBe(true);
  });

  it("returns false for direct when directEnabled is false", () => {
    expect(
      shouldAckReactionForWhatsApp({
        ...base,
        isDirect: true,
        isGroup: false,
        directEnabled: false,
      }),
    ).toBe(false);
  });

  it("returns false for group when groupMode is never", () => {
    expect(shouldAckReactionForWhatsApp({ ...base, groupMode: "never" })).toBe(false);
  });

  it("returns true for group when groupMode is always", () => {
    expect(shouldAckReactionForWhatsApp({ ...base, groupMode: "always" })).toBe(true);
  });

  it("returns true for group mentions mode when mentioned", () => {
    expect(
      shouldAckReactionForWhatsApp({ ...base, groupMode: "mentions", wasMentioned: true }),
    ).toBe(true);
  });

  it("returns false for group mentions mode when not mentioned", () => {
    expect(
      shouldAckReactionForWhatsApp({ ...base, groupMode: "mentions", wasMentioned: false }),
    ).toBe(false);
  });

  it("returns false when not direct and not group", () => {
    expect(shouldAckReactionForWhatsApp({ ...base, isDirect: false, isGroup: false })).toBe(false);
  });
});
