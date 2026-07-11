import { describe, it, expect, vi } from "vitest";
import EnemyCombat, { getAvailableAttacks, AggressiveCombatEntity, CombatEntity } from "./EnemyCombat";
import StatusEffectController from "./StatusEffectController";
import { ATTACKS } from "./Attack";

function makeEntity(aggressionLevel: number): AggressiveCombatEntity {
  return {
    x: 0,
    y: 0,
    statusEffects: new StatusEffectController(),
    aggressionLevel,
  };
}

describe("getAvailableAttacks", () => {
  it("only includes attacks at or below the given aggression level", () => {
    const available = getAvailableAttacks(1, new Map());
    expect(available.map((a) => a.id)).toEqual(["brace"]);
  });

  it("excludes attacks still on cooldown", () => {
    const cooldowns = new Map([["brace", 2000]]);
    expect(getAvailableAttacks(1, cooldowns).map((a) => a.id)).toEqual([]);
  });

  it("includes an attack once its cooldown has reached zero", () => {
    const cooldowns = new Map([["brace", 0]]);
    expect(getAvailableAttacks(1, cooldowns).map((a) => a.id)).toEqual(["brace"]);
  });
});

describe("EnemyCombat", () => {
  it("does not attempt an attack before the trigger interval has passed", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const selector = vi.fn(() => ATTACKS[0]);
    const combat = new EnemyCombat(enemy, () => player, { selector });
    combat.update(1000); // default interval is 1500ms
    expect(selector).not.toHaveBeenCalled();
  });

  it("attempts an attack once the trigger interval has passed", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const selector = vi.fn(() => ATTACKS[0]);
    const combat = new EnemyCombat(enemy, () => player, { selector });
    combat.update(1500);
    expect(selector).toHaveBeenCalled();
  });

  it("applies a self-targeted effect to the enemy, not the player", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const combat = new EnemyCombat(enemy, () => player, {
      selector: (_enemy, available) => available.find((a) => a.id === "brace") ?? null,
    });
    combat.update(1500);
    expect(enemy.statusEffects.has("unstoppable")).toBe(true);
    expect(player.statusEffects.has("unstoppable")).toBe(false);
  });

  it("applies a target-targeted effect to the player, not the enemy", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const combat = new EnemyCombat(enemy, () => player, {
      selector: (_enemy, available) => available.find((a) => a.id === "nagging_reminder") ?? null,
    });
    combat.update(1500);
    expect(player.statusEffects.has("slow")).toBe(true);
    expect(enemy.statusEffects.has("slow")).toBe(false);
  });

  it("puts the chosen attack on cooldown so it isn't chosen again before the cooldown elapses", () => {
    const enemy = makeEntity(1); // only "brace" is available at aggression 1
    const player: CombatEntity = makeEntity(0);
    const selector = vi.fn((_enemy: AggressiveCombatEntity, available: ReturnType<typeof getAvailableAttacks>) => available[0] ?? null);
    const combat = new EnemyCombat(enemy, () => player, { selector, trigger: () => true });

    combat.update(0);
    expect(selector).toHaveBeenLastCalledWith(enemy, expect.arrayContaining([expect.objectContaining({ id: "brace" })]));

    combat.update(0);
    expect(selector).toHaveBeenLastCalledWith(enemy, []);
  });

  it("does nothing when the selector returns null", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const combat = new EnemyCombat(enemy, () => player, { selector: () => null });
    expect(() => combat.update(1500)).not.toThrow();
    expect(player.statusEffects.getActiveIds()).toEqual([]);
  });

  it("works end-to-end with the default trigger and selector", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const combat = new EnemyCombat(enemy, () => player);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0); // picks the first available attack
    combat.update(1500);
    randomSpy.mockRestore();
    expect(enemy.statusEffects.has("unstoppable")).toBe(true); // "brace" is available[0] at aggression 3
  });
});
