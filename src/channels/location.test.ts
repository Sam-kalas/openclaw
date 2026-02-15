import { describe, expect, it } from "vitest";
import { formatLocationText, toLocationContext } from "./location.js";

describe("formatLocationText", () => {
  it("formats a basic pin location", () => {
    const result = formatLocationText({ latitude: 40.7128, longitude: -74.006 });
    expect(result).toBe("📍 40.712800, -74.006000");
  });

  it("formats a pin with accuracy", () => {
    const result = formatLocationText({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 15.7,
    });
    expect(result).toBe("📍 40.712800, -74.006000 ±16m");
  });

  it("formats a named place", () => {
    const result = formatLocationText({
      latitude: 48.8566,
      longitude: 2.3522,
      name: "Eiffel Tower",
    });
    expect(result).toBe("📍 Eiffel Tower (48.856600, 2.352200)");
  });

  it("formats a place with name and address", () => {
    const result = formatLocationText({
      latitude: 48.8566,
      longitude: 2.3522,
      name: "Eiffel Tower",
      address: "Champ de Mars, Paris",
    });
    expect(result).toBe("📍 Eiffel Tower — Champ de Mars, Paris (48.856600, 2.352200)");
  });

  it("formats a live location", () => {
    const result = formatLocationText({
      latitude: 40.7128,
      longitude: -74.006,
      isLive: true,
      source: "live",
    });
    expect(result).toBe("🛰 Live location: 40.712800, -74.006000");
  });

  it("formats a live location with accuracy", () => {
    const result = formatLocationText({
      latitude: 40.7128,
      longitude: -74.006,
      isLive: true,
      source: "live",
      accuracy: 10,
    });
    expect(result).toBe("🛰 Live location: 40.712800, -74.006000 ±10m");
  });

  it("appends caption on a new line", () => {
    const result = formatLocationText({
      latitude: 40.7128,
      longitude: -74.006,
      caption: "Meet me here",
    });
    expect(result).toBe("📍 40.712800, -74.006000\nMeet me here");
  });

  it("handles place source without explicit isLive", () => {
    const result = formatLocationText({
      latitude: 1.0,
      longitude: 2.0,
      name: "Cafe",
      source: "place",
    });
    expect(result).toContain("📍 Cafe");
  });
});

describe("toLocationContext", () => {
  it("converts basic location to context object", () => {
    const ctx = toLocationContext({
      latitude: 40.7128,
      longitude: -74.006,
    });
    expect(ctx.LocationLat).toBe(40.7128);
    expect(ctx.LocationLon).toBe(-74.006);
    expect(ctx.LocationIsLive).toBe(false);
    expect(ctx.LocationSource).toBe("pin");
  });

  it("converts live location", () => {
    const ctx = toLocationContext({
      latitude: 40.7128,
      longitude: -74.006,
      isLive: true,
      source: "live",
    });
    expect(ctx.LocationIsLive).toBe(true);
    expect(ctx.LocationSource).toBe("live");
  });

  it("includes name and address", () => {
    const ctx = toLocationContext({
      latitude: 48.0,
      longitude: 2.0,
      name: "Cafe",
      address: "123 Rue de Paris",
    });
    expect(ctx.LocationName).toBe("Cafe");
    expect(ctx.LocationAddress).toBe("123 Rue de Paris");
  });

  it("includes accuracy", () => {
    const ctx = toLocationContext({
      latitude: 48.0,
      longitude: 2.0,
      accuracy: 25,
    });
    expect(ctx.LocationAccuracy).toBe(25);
  });

  it("resolves source from name when not explicit", () => {
    const ctx = toLocationContext({
      latitude: 0,
      longitude: 0,
      name: "Place",
    });
    expect(ctx.LocationSource).toBe("place");
  });
});
