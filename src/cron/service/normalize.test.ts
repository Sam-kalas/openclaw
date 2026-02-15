import { describe, expect, it } from "vitest";
import type { CronPayload } from "../types.js";
import {
  normalizeRequiredName,
  normalizeOptionalText,
  normalizeOptionalAgentId,
  inferLegacyName,
  normalizePayloadToSystemText,
} from "./normalize.js";

describe("normalizeRequiredName", () => {
  it("returns trimmed name", () => {
    expect(normalizeRequiredName("  my job  ")).toBe("my job");
  });

  it("throws for non-string", () => {
    expect(() => normalizeRequiredName(undefined)).toThrow("cron job name is required");
    expect(() => normalizeRequiredName(null)).toThrow("cron job name is required");
    expect(() => normalizeRequiredName(42)).toThrow("cron job name is required");
  });

  it("throws for empty string", () => {
    expect(() => normalizeRequiredName("")).toThrow("cron job name is required");
    expect(() => normalizeRequiredName("   ")).toThrow("cron job name is required");
  });
});

describe("normalizeOptionalText", () => {
  it("returns trimmed text", () => {
    expect(normalizeOptionalText("  hello  ")).toBe("hello");
  });

  it("returns undefined for non-string", () => {
    expect(normalizeOptionalText(undefined)).toBeUndefined();
    expect(normalizeOptionalText(null)).toBeUndefined();
    expect(normalizeOptionalText(42)).toBeUndefined();
  });

  it("returns undefined for empty/whitespace string", () => {
    expect(normalizeOptionalText("")).toBeUndefined();
    expect(normalizeOptionalText("   ")).toBeUndefined();
  });
});

describe("normalizeOptionalAgentId", () => {
  it("returns normalized agent id", () => {
    expect(normalizeOptionalAgentId("MyAgent")).toBe("myagent");
  });

  it("returns undefined for non-string", () => {
    expect(normalizeOptionalAgentId(undefined)).toBeUndefined();
    expect(normalizeOptionalAgentId(null)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizeOptionalAgentId("")).toBeUndefined();
    expect(normalizeOptionalAgentId("  ")).toBeUndefined();
  });
});

describe("inferLegacyName", () => {
  it("uses first line of systemEvent text", () => {
    expect(
      inferLegacyName({
        schedule: { kind: "every", everyMs: 5000 },
        payload: { kind: "systemEvent", text: "Hello\nWorld" },
      }),
    ).toBe("Hello");
  });

  it("uses first line of agentTurn message", () => {
    expect(
      inferLegacyName({
        schedule: { kind: "every", everyMs: 5000 },
        payload: { kind: "agentTurn", message: "Do something\nMore info" },
      }),
    ).toBe("Do something");
  });

  it("truncates long text to 60 chars", () => {
    const longText = "A".repeat(100);
    const result = inferLegacyName({
      payload: { kind: "systemEvent", text: longText },
    });
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("falls back to cron expression", () => {
    expect(
      inferLegacyName({
        schedule: { kind: "cron", expr: "*/5 * * * *" },
        payload: { kind: "systemEvent", text: "" },
      }),
    ).toBe("Cron: */5 * * * *");
  });

  it("falls back to every interval", () => {
    expect(
      inferLegacyName({
        schedule: { kind: "every", everyMs: 60000 },
        payload: { kind: "systemEvent", text: "" },
      }),
    ).toBe("Every: 60000ms");
  });

  it("falls back to One-shot for at schedule", () => {
    expect(
      inferLegacyName({
        schedule: { kind: "at" },
        payload: { kind: "systemEvent", text: "" },
      }),
    ).toBe("One-shot");
  });

  it("falls back to generic Cron job", () => {
    expect(inferLegacyName({})).toBe("Cron job");
  });
});

describe("normalizePayloadToSystemText", () => {
  it("returns text for systemEvent", () => {
    const payload: CronPayload = { kind: "systemEvent", text: "  hello  " };
    expect(normalizePayloadToSystemText(payload)).toBe("hello");
  });

  it("returns message for agentTurn", () => {
    const payload: CronPayload = { kind: "agentTurn", message: "  do work  " };
    expect(normalizePayloadToSystemText(payload)).toBe("do work");
  });
});
