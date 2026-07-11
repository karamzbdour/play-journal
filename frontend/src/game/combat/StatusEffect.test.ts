import { describe, it, expect } from "vitest";
import { STATUS_EFFECTS } from "./StatusEffect";

describe("STATUS_EFFECTS catalog", () => {
  it("keys every definition under its own id", () => {
    for (const [key, def] of Object.entries(STATUS_EFFECTS)) {
      expect(def.id).toBe(key);
    }
  });

  it("marks unstoppable as blocking cc-tagged effects", () => {
    expect(STATUS_EFFECTS.unstoppable.blocksTags).toContain("cc");
  });

  it("tags slow and suppressed as cc", () => {
    expect(STATUS_EFFECTS.slow.tags).toContain("cc");
    expect(STATUS_EFFECTS.suppressed.tags).toContain("cc");
  });

  it("gives slow a magnitude under 1 (a speed reduction)", () => {
    expect(STATUS_EFFECTS.slow.magnitude).toBeLessThan(1);
  });

  it("gives bonus_damage a positive magnitude", () => {
    expect(STATUS_EFFECTS.bonus_damage.magnitude).toBeGreaterThan(0);
  });

  it("does not tag charge_time as cc, so a future unstoppable buff wouldn't block a self-initiated charge", () => {
    expect(STATUS_EFFECTS.charge_time.tags).not.toContain("cc");
  });
});
