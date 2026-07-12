import { describe, it, expect } from "vitest";
import CooldownTracker from "@/game/combat/CooldownTracker";

describe("CooldownTracker", () => {
  it("is ready for ids that were never started", () => {
    expect(new CooldownTracker().isReady("anything")).toBe(true);
  });

  it("is not ready while a started cooldown is running", () => {
    const tracker = new CooldownTracker();
    tracker.start("slash", 500);
    tracker.tick(499);
    expect(tracker.isReady("slash")).toBe(false);
  });

  it("becomes ready once the full duration has elapsed", () => {
    const tracker = new CooldownTracker();
    tracker.start("slash", 500);
    tracker.tick(500);
    expect(tracker.isReady("slash")).toBe(true);
  });

  it("accumulates ticks across multiple updates", () => {
    const tracker = new CooldownTracker();
    tracker.start("slash", 500);
    tracker.tick(200);
    tracker.tick(200);
    expect(tracker.isReady("slash")).toBe(false);
    tracker.tick(100);
    expect(tracker.isReady("slash")).toBe(true);
  });

  it("treats a zero-duration cooldown as immediately ready", () => {
    const tracker = new CooldownTracker();
    tracker.start("slash", 0);
    expect(tracker.isReady("slash")).toBe(true);
  });

  it("tracks ids independently", () => {
    const tracker = new CooldownTracker();
    tracker.start("a", 1000);
    tracker.start("b", 200);
    tracker.tick(300);
    expect(tracker.isReady("a")).toBe(false);
    expect(tracker.isReady("b")).toBe(true);
  });
});
