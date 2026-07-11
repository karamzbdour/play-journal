import { describe, it, expect } from "vitest";
import { WEAPON_ATTACKS, BASIC_ATTACK } from "@/game/combat/WeaponAttack";
import { STATUS_EFFECTS } from "@/game/combat/StatusEffect";

describe("WEAPON_ATTACKS catalog", () => {
  it("only references effect ids that exist in STATUS_EFFECTS", () => {
    for (const attack of WEAPON_ATTACKS) {
      for (const component of attack.effects) {
        if (component.kind !== "status") continue;
        expect(STATUS_EFFECTS[component.effectId]).toBeDefined();
      }
    }
  });

  it("has unique attack ids", () => {
    const ids = WEAPON_ATTACKS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes at least one attack that deals damage with no status effect (a plain hit)", () => {
    const isPlainHit = (attack: (typeof WEAPON_ATTACKS)[number]) =>
      attack.effects.some((c) => c.kind === "damage") && !attack.effects.some((c) => c.kind === "status");
    expect(WEAPON_ATTACKS.some(isPlainHit)).toBe(true);
  });

  it("gives every attack a positive cooldown", () => {
    for (const attack of WEAPON_ATTACKS) {
      expect(attack.cooldownMs).toBeGreaterThan(0);
    }
  });

  it("gives every explicit damage amount a positive value", () => {
    for (const attack of WEAPON_ATTACKS) {
      for (const component of attack.effects) {
        if (component.kind === "damage" && component.amount !== undefined) {
          expect(component.amount).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("BASIC_ATTACK", () => {
  it("deals damage to the target with no fixed amount, deferring to the wielder's weapon", () => {
    const damageComponent = BASIC_ATTACK.effects.find((c) => c.kind === "damage");
    expect(damageComponent).toBeDefined();
    expect(damageComponent!.target).toBe("target");
    expect((damageComponent as { amount?: number }).amount).toBeUndefined();
  });

  it("also applies a brief slow to the target", () => {
    const statusComponent = BASIC_ATTACK.effects.find((c) => c.kind === "status");
    expect(statusComponent).toMatchObject({ effectId: "slow", target: "target" });
  });

  it("is not part of the randomized attackIds pool", () => {
    expect(WEAPON_ATTACKS.some((a) => a.id === BASIC_ATTACK.id)).toBe(false);
  });
});
