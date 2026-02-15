import { describe, expect, it } from "vitest";
import type { SessionEntry } from "../config/sessions.js";
import { applyModelOverrideToSessionEntry } from "./model-overrides.js";

function makeEntry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return { sessionId: "test", updatedAt: 0, ...overrides };
}

describe("applyModelOverrideToSessionEntry", () => {
  it("sets provider and model on fresh entry", () => {
    const entry = makeEntry();
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openrouter", model: "gpt-4o" },
    });
    expect(result.updated).toBe(true);
    expect(entry.providerOverride).toBe("openrouter");
    expect(entry.modelOverride).toBe("gpt-4o");
  });

  it("reports no update when values already match", () => {
    const entry = makeEntry({ providerOverride: "openrouter", modelOverride: "gpt-4o" });
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openrouter", model: "gpt-4o" },
    });
    expect(result.updated).toBe(false);
  });

  it("clears overrides when selection is default", () => {
    const entry = makeEntry({ providerOverride: "openrouter", modelOverride: "gpt-4o" });
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openrouter", model: "gpt-4o", isDefault: true },
    });
    expect(result.updated).toBe(true);
    expect(entry.providerOverride).toBeUndefined();
    expect(entry.modelOverride).toBeUndefined();
  });

  it("reports no update when clearing already-clear defaults", () => {
    const entry = makeEntry();
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "", model: "", isDefault: true },
    });
    expect(result.updated).toBe(false);
  });

  it("sets authProfileOverride when profileOverride provided", () => {
    const entry = makeEntry();
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openrouter", model: "gpt-4o" },
      profileOverride: "profile-1",
    });
    expect(result.updated).toBe(true);
    expect(entry.authProfileOverride).toBe("profile-1");
    expect(entry.authProfileOverrideSource).toBe("user");
  });

  it("uses auto source when specified", () => {
    const entry = makeEntry();
    applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openrouter", model: "gpt-4o" },
      profileOverride: "profile-1",
      profileOverrideSource: "auto",
    });
    expect(entry.authProfileOverrideSource).toBe("auto");
  });

  it("clears authProfileOverride when profileOverride not provided", () => {
    const entry = makeEntry({
      authProfileOverride: "old-profile",
      authProfileOverrideSource: "user",
    });
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openrouter", model: "gpt-4o" },
    });
    expect(result.updated).toBe(true);
    expect(entry.authProfileOverride).toBeUndefined();
    expect(entry.authProfileOverrideSource).toBeUndefined();
  });

  it("clears authProfileOverrideCompactionCount when profileOverride provided", () => {
    const entry = makeEntry({
      authProfileOverride: "old",
      authProfileOverrideCompactionCount: 5,
    } as SessionEntry);
    const result = applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openrouter", model: "gpt-4o" },
      profileOverride: "new-profile",
    });
    expect(result.updated).toBe(true);
    expect(
      (entry as unknown as Record<string, unknown>).authProfileOverrideCompactionCount,
    ).toBeUndefined();
  });

  it("sets updatedAt timestamp when changes are made", () => {
    const entry = makeEntry();
    const before = Date.now();
    applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openrouter", model: "gpt-4o" },
    });
    expect(entry.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("does not update timestamp when no changes", () => {
    const entry = makeEntry({ providerOverride: "openrouter", modelOverride: "gpt-4o" });
    entry.updatedAt = 12345;
    applyModelOverrideToSessionEntry({
      entry,
      selection: { provider: "openrouter", model: "gpt-4o" },
    });
    expect(entry.updatedAt).toBe(12345);
  });
});
