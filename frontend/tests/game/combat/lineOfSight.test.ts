import { describe, it, expect } from "vitest";
import { isWithinRange, hasLineOfSight, LineOfSightBlocker } from "@/game/combat/lineOfSight";

describe("isWithinRange", () => {
  it("is true when the distance is less than the max range", () => {
    expect(isWithinRange(0, 0, 10, 0, 20)).toBe(true);
  });

  it("is true when the distance exactly equals the max range", () => {
    expect(isWithinRange(0, 0, 20, 0, 20)).toBe(true);
  });

  it("is false when the distance exceeds the max range", () => {
    expect(isWithinRange(0, 0, 21, 0, 20)).toBe(false);
  });
});

describe("hasLineOfSight", () => {
  const open: LineOfSightBlocker = { isBlocked: () => false };

  it("is true when nothing blocks the line", () => {
    expect(hasLineOfSight(open, 0, 0, 100, 0)).toBe(true);
  });

  it("is false when a sampled point along the line is blocked", () => {
    const wallAtMidpoint: LineOfSightBlocker = {
      isBlocked: (x) => Math.abs(x - 50) < 6,
    };
    expect(hasLineOfSight(wallAtMidpoint, 0, 0, 100, 0)).toBe(false);
  });

  it("is true when the blocker only blocks points off the line", () => {
    const blocksElsewhere: LineOfSightBlocker = {
      isBlocked: (x, y) => y > 10, // the test line stays at y = 0
    };
    expect(hasLineOfSight(blocksElsewhere, 0, 0, 100, 0)).toBe(true);
  });
});
