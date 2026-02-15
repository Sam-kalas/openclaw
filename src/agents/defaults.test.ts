import { describe, expect, it } from "vitest";
import { DEFAULT_PROVIDER, DEFAULT_MODEL, DEFAULT_CONTEXT_TOKENS } from "./defaults.js";

describe("agent defaults", () => {
  it("exports DEFAULT_PROVIDER as anthropic", () => {
    expect(DEFAULT_PROVIDER).toBe("anthropic");
  });

  it("exports DEFAULT_MODEL", () => {
    expect(DEFAULT_MODEL).toBe("claude-opus-4-6");
  });

  it("exports DEFAULT_CONTEXT_TOKENS as 200K", () => {
    expect(DEFAULT_CONTEXT_TOKENS).toBe(200_000);
  });
});
