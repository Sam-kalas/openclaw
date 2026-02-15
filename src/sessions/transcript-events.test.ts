import { describe, expect, it } from "vitest";
import { onSessionTranscriptUpdate, emitSessionTranscriptUpdate } from "./transcript-events.js";

describe("transcript-events", () => {
  it("listener receives emitted updates", () => {
    const received: string[] = [];
    const unsubscribe = onSessionTranscriptUpdate((update) => {
      received.push(update.sessionFile);
    });
    emitSessionTranscriptUpdate("/path/to/session.jsonl");
    expect(received).toEqual(["/path/to/session.jsonl"]);
    unsubscribe();
  });

  it("unsubscribe stops further notifications", () => {
    const received: string[] = [];
    const unsubscribe = onSessionTranscriptUpdate((update) => {
      received.push(update.sessionFile);
    });
    emitSessionTranscriptUpdate("first");
    unsubscribe();
    emitSessionTranscriptUpdate("second");
    expect(received).toEqual(["first"]);
  });

  it("multiple listeners all receive events", () => {
    const received1: string[] = [];
    const received2: string[] = [];
    const unsub1 = onSessionTranscriptUpdate((u) => received1.push(u.sessionFile));
    const unsub2 = onSessionTranscriptUpdate((u) => received2.push(u.sessionFile));
    emitSessionTranscriptUpdate("event");
    expect(received1).toEqual(["event"]);
    expect(received2).toEqual(["event"]);
    unsub1();
    unsub2();
  });

  it("does not emit for empty or whitespace-only paths", () => {
    const received: string[] = [];
    const unsubscribe = onSessionTranscriptUpdate((u) => received.push(u.sessionFile));
    emitSessionTranscriptUpdate("");
    emitSessionTranscriptUpdate("   ");
    expect(received).toEqual([]);
    unsubscribe();
  });

  it("trims the session file path", () => {
    const received: string[] = [];
    const unsubscribe = onSessionTranscriptUpdate((u) => received.push(u.sessionFile));
    emitSessionTranscriptUpdate("  /path/to/file.jsonl  ");
    expect(received).toEqual(["/path/to/file.jsonl"]);
    unsubscribe();
  });
});
