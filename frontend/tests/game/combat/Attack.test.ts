import { describe, it, expect } from "vitest";
import { ATTACKS } from "@/game/combat/Attack";
import { STATUS_EFFECTS } from "@/game/combat/StatusEffect";

describe("ATTACKS catalog", () => {
  it("only references effect ids that exist in STATUS_EFFECTS", () => {
    for (const attack of ATTACKS) {
      for (const component of attack.effects) {
        if (component.kind !== "status") continue;
        expect(STATUS_EFFECTS[component.effectId]).toBeDefined();
      }
    }
  });

  it("has unique attack ids", () => {
    const ids = ATTACKS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("requires strictly higher aggression for silencing_glare than for brace", () => {
    const brace = ATTACKS.find((a) => a.id === "brace")!;
    const glare = ATTACKS.find((a) => a.id === "silencing_glare")!;
    expect(glare.minAggression).toBeGreaterThan(brace.minAggression);
  });

  it("requires line of sight and an 8-tile range on all current attacks", () => {
    for (const attack of ATTACKS) {
      expect(attack.requiresLineOfSight).toBe(true);
      expect(attack.maxRangeTiles).toBe(8);
    }
  });

  it("gives nagging_reminder and silencing_glare a damage component targeting the target", () => {
    for (const id of ["nagging_reminder", "silencing_glare"]) {
      const attack = ATTACKS.find((a) => a.id === id)!;
      const damageComponents = attack.effects.filter((c) => c.kind === "damage" && c.target === "target");
      expect(damageComponents.length).toBeGreaterThan(0);
    }
  });

  it("gives brace no damage component (it's a self-only buff)", () => {
    const brace = ATTACKS.find((a) => a.id === "brace")!;
    expect(brace.effects.some((c) => c.kind === "damage")).toBe(false);
  });
});
