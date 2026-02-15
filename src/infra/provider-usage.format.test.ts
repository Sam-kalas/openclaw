import { describe, expect, it } from "vitest";
import type { ProviderUsageSnapshot, UsageSummary } from "./provider-usage.types.js";
import {
  formatUsageWindowSummary,
  formatUsageSummaryLine,
  formatUsageReportLines,
} from "./provider-usage.format.js";

const mkSnapshot = (overrides?: Partial<ProviderUsageSnapshot>): ProviderUsageSnapshot => ({
  provider: "anthropic",
  displayName: "Claude",
  windows: [],
  ...overrides,
});

const mkSummary = (providers: ProviderUsageSnapshot[]): UsageSummary => ({
  updatedAt: Date.now(),
  providers,
});

describe("formatUsageWindowSummary", () => {
  it("returns null when snapshot has error", () => {
    expect(formatUsageWindowSummary(mkSnapshot({ error: "fail" }))).toBeNull();
  });

  it("returns null for empty windows", () => {
    expect(formatUsageWindowSummary(mkSnapshot({ windows: [] }))).toBeNull();
  });

  it("formats a single window without resets", () => {
    const result = formatUsageWindowSummary(
      mkSnapshot({
        windows: [{ label: "daily", usedPercent: 30 }],
      }),
    );
    expect(result).toBe("daily 70% left");
  });

  it("formats multiple windows", () => {
    const result = formatUsageWindowSummary(
      mkSnapshot({
        windows: [
          { label: "daily", usedPercent: 20 },
          { label: "monthly", usedPercent: 50 },
        ],
      }),
    );
    expect(result).toBe("daily 80% left · monthly 50% left");
  });

  it("respects maxWindows option", () => {
    const result = formatUsageWindowSummary(
      mkSnapshot({
        windows: [
          { label: "daily", usedPercent: 10 },
          { label: "weekly", usedPercent: 20 },
          { label: "monthly", usedPercent: 30 },
        ],
      }),
      { maxWindows: 2 },
    );
    expect(result).toBe("daily 90% left · weekly 80% left");
  });

  it("includes resets when requested", () => {
    const now = 1000000;
    const result = formatUsageWindowSummary(
      mkSnapshot({
        windows: [{ label: "daily", usedPercent: 40, resetAt: now + 30 * 60000 }],
      }),
      { now, includeResets: true },
    );
    expect(result).toBe("daily 60% left ⏱30m");
  });

  it("shows reset as 'now' when past", () => {
    const now = 1000000;
    const result = formatUsageWindowSummary(
      mkSnapshot({
        windows: [{ label: "daily", usedPercent: 40, resetAt: now - 100 }],
      }),
      { now, includeResets: true },
    );
    expect(result).toBe("daily 60% left ⏱now");
  });

  it("clamps remaining percent to 0-100", () => {
    const result = formatUsageWindowSummary(
      mkSnapshot({
        windows: [{ label: "daily", usedPercent: 120 }],
      }),
    );
    expect(result).toBe("daily 0% left");
  });
});

describe("formatUsageSummaryLine", () => {
  it("returns null when no providers have windows", () => {
    const summary = mkSummary([mkSnapshot({ windows: [] })]);
    expect(formatUsageSummaryLine(summary)).toBeNull();
  });

  it("returns null when all providers have errors", () => {
    const summary = mkSummary([
      mkSnapshot({ error: "fail", windows: [{ label: "d", usedPercent: 10 }] }),
    ]);
    expect(formatUsageSummaryLine(summary)).toBeNull();
  });

  it("formats single provider summary", () => {
    const summary = mkSummary([
      mkSnapshot({
        displayName: "Claude",
        windows: [{ label: "daily", usedPercent: 25 }],
      }),
    ]);
    const result = formatUsageSummaryLine(summary);
    expect(result).toContain("📊 Usage:");
    expect(result).toContain("Claude");
    expect(result).toContain("75% left");
  });

  it("formats multiple providers", () => {
    const summary = mkSummary([
      mkSnapshot({
        displayName: "Claude",
        windows: [{ label: "daily", usedPercent: 25 }],
      }),
      mkSnapshot({
        provider: "zai",
        displayName: "z.ai",
        windows: [{ label: "monthly", usedPercent: 60 }],
      }),
    ]);
    const result = formatUsageSummaryLine(summary);
    expect(result).toContain("Claude");
    expect(result).toContain("z.ai");
  });

  it("picks highest usage window for display", () => {
    const summary = mkSummary([
      mkSnapshot({
        displayName: "Claude",
        windows: [
          { label: "daily", usedPercent: 10 },
          { label: "monthly", usedPercent: 80 },
        ],
      }),
    ]);
    const result = formatUsageSummaryLine(summary);
    // The primary window is the one with highest usedPercent (monthly 80%)
    expect(result).toContain("20% left");
    expect(result).toContain("monthly");
  });

  it("respects maxProviders", () => {
    const summary = mkSummary([
      mkSnapshot({ displayName: "A", windows: [{ label: "d", usedPercent: 10 }] }),
      mkSnapshot({ displayName: "B", windows: [{ label: "d", usedPercent: 20 }] }),
      mkSnapshot({ displayName: "C", windows: [{ label: "d", usedPercent: 30 }] }),
    ]);
    const result = formatUsageSummaryLine(summary, { maxProviders: 1 });
    expect(result).toContain("A");
    expect(result).not.toContain("B");
  });
});

describe("formatUsageReportLines", () => {
  it("returns fallback for empty providers", () => {
    const summary = mkSummary([]);
    const lines = formatUsageReportLines(summary);
    expect(lines).toEqual(["Usage: no provider usage available."]);
  });

  it("formats provider with error", () => {
    const summary = mkSummary([mkSnapshot({ displayName: "Claude", error: "timeout" })]);
    const lines = formatUsageReportLines(summary);
    expect(lines).toContain("Usage:");
    expect(lines.some((l) => l.includes("Claude") && l.includes("timeout"))).toBe(true);
  });

  it("formats provider with no data", () => {
    const summary = mkSummary([mkSnapshot({ displayName: "Claude", windows: [] })]);
    const lines = formatUsageReportLines(summary);
    expect(lines.some((l) => l.includes("no data"))).toBe(true);
  });

  it("formats provider with windows and plan", () => {
    const summary = mkSummary([
      mkSnapshot({
        displayName: "Claude",
        plan: "pro",
        windows: [{ label: "daily", usedPercent: 30 }],
      }),
    ]);
    const lines = formatUsageReportLines(summary);
    expect(lines.some((l) => l.includes("(pro)"))).toBe(true);
    expect(lines.some((l) => l.includes("70% left"))).toBe(true);
  });

  it("includes reset time when provided", () => {
    const now = 1000000;
    const summary = mkSummary([
      mkSnapshot({
        displayName: "Claude",
        windows: [{ label: "daily", usedPercent: 40, resetAt: now + 120 * 60000 }],
      }),
    ]);
    const lines = formatUsageReportLines(summary, { now });
    expect(lines.some((l) => l.includes("resets 2h"))).toBe(true);
  });
});
