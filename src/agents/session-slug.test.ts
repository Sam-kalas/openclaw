import { describe, expect, it } from "vitest";
import { createSessionSlug } from "./session-slug.js";

describe("createSessionSlug", () => {
  it("returns a string", () => {
    const slug = createSessionSlug();
    expect(typeof slug).toBe("string");
    expect(slug.length).toBeGreaterThan(0);
  });

  it("returns adjective-noun format", () => {
    const slug = createSessionSlug();
    expect(slug.split("-").length).toBeGreaterThanOrEqual(2);
  });

  it("avoids taken slugs by appending suffix", () => {
    const taken = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const slug = createSessionSlug((id) => taken.has(id));
      expect(taken.has(slug)).toBe(false);
      taken.add(slug);
    }
  });

  it("never returns the same slug when isTaken rejects it", () => {
    const slugs = new Set<string>();
    let calls = 0;
    const isTaken = (id: string) => {
      calls++;
      if (calls <= 3) {
        return true;
      }
      return slugs.has(id);
    };
    const slug = createSessionSlug(isTaken);
    expect(slug).toBeTruthy();
  });

  it("falls back to 3-word slugs when 2-word space is exhausted", () => {
    let attempts = 0;
    const slug = createSessionSlug(() => {
      attempts++;
      return attempts < 200;
    });
    expect(slug).toBeTruthy();
    expect(slug.length).toBeGreaterThan(0);
  });
});
