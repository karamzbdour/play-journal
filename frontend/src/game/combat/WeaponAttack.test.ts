import { describe, it, expect } from "vitest";
import { WEAPON_ATTACKS } from "./WeaponAttack";
import { STATUS_EFFECTS } from "./StatusEffect";

describe("WEAPON_ATTACKS catalog", () => {
  it("only references effect ids that exist in STATUS_EFFECTS", () => {
    for (const attack of WEAPON_ATTACKS) {
      for (const application of attack.effects) {
        expect(STATUS_EFFECTS[application.effectId]).toBeDefined();
      }
    }
  });

  it("has unique attack ids", () => {
    const ids = WEAPON_ATTACKS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes at least one attack with no effects (a plain hit)", () => {
    expect(WEAPON_ATTACKS.some((a) => a.effects.length === 0)).toBe(true);
  });

  it("gives every attack a positive cooldown", () => {
    for (const attack of WEAPON_ATTACKS) {
      expect(attack.cooldownMs).toBeGreaterThan(0);
    }
  });
});
