import { describe, expect, it } from "vitest";
import { validateScheduleTimestamp } from "./validate-timestamp.js";

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const TEN_YEARS_MS = 10 * 365.25 * 24 * 60 * 60 * 1000;

describe("validateScheduleTimestamp", () => {
  const NOW = Date.parse("2026-01-15T12:00:00Z");

  it("passes for non-at schedules", () => {
    expect(validateScheduleTimestamp({ kind: "every", everyMs: 60000 }, NOW)).toEqual({ ok: true });
    expect(validateScheduleTimestamp({ kind: "cron", expr: "* * * * *" }, NOW)).toEqual({
      ok: true,
    });
  });

  it("passes for at schedule within valid range", () => {
    const futureAt = new Date(NOW + ONE_HOUR_MS).toISOString();
    expect(validateScheduleTimestamp({ kind: "at", at: futureAt }, NOW)).toEqual({ ok: true });
  });

  it("passes for at schedule within 1 minute grace period", () => {
    const recentPast = new Date(NOW - 30_000).toISOString(); // 30s ago
    expect(validateScheduleTimestamp({ kind: "at", at: recentPast }, NOW)).toEqual({ ok: true });
  });

  it("fails for at schedule more than 1 minute in the past", () => {
    const oldPast = new Date(NOW - 2 * ONE_MINUTE_MS).toISOString();
    const result = validateScheduleTimestamp({ kind: "at", at: oldPast }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("in the past");
    }
  });

  it("fails for at schedule more than 10 years in the future", () => {
    const farFuture = new Date(NOW + TEN_YEARS_MS + ONE_HOUR_MS).toISOString();
    const result = validateScheduleTimestamp({ kind: "at", at: farFuture }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("too far in the future");
    }
  });

  it("fails for invalid at value", () => {
    const result = validateScheduleTimestamp({ kind: "at", at: "not-a-date" }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Invalid schedule.at");
    }
  });

  it("fails for empty at value", () => {
    const result = validateScheduleTimestamp({ kind: "at", at: "" }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Invalid schedule.at");
    }
  });

  it("passes at exact boundary (10 years future minus margin)", () => {
    const nearLimit = new Date(NOW + TEN_YEARS_MS - ONE_HOUR_MS).toISOString();
    expect(validateScheduleTimestamp({ kind: "at", at: nearLimit }, NOW)).toEqual({ ok: true });
  });

  it("passes at exact boundary (1 minute past)", () => {
    const justPast = new Date(NOW - ONE_MINUTE_MS).toISOString();
    expect(validateScheduleTimestamp({ kind: "at", at: justPast }, NOW)).toEqual({ ok: true });
  });
});
