import { describe, it, expect, vi } from "vitest";
import EnemyCombat, { getAvailableAttacks, AggressiveCombatEntity, CombatEntity } from "@/game/combat/EnemyCombat";
import StatusEffectController from "@/game/combat/StatusEffectController";
import { ATTACKS, AttackDefinition } from "@/game/combat/Attack";
import { LineOfSightBlocker } from "@/game/combat/lineOfSight";

const OPEN_BLOCKER: LineOfSightBlocker = { isBlocked: () => false };

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
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, { selector });
    combat.update(1000); // default interval is 1500ms
    expect(selector).not.toHaveBeenCalled();
  });

  it("attempts an attack once the trigger interval has passed", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const selector = vi.fn(() => ATTACKS[0]);
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, { selector });
    combat.update(1500);
    expect(selector).toHaveBeenCalled();
  });

  it("applies a self-targeted effect to the enemy, not the player", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, {
      selector: (_enemy, available) => available.find((a) => a.id === "brace") ?? null,
    });
    combat.update(1500);
    expect(enemy.statusEffects.has("unstoppable")).toBe(true);
    expect(player.statusEffects.has("unstoppable")).toBe(false);
  });

  it("applies a target-targeted effect to the player, not the enemy", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, {
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
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, { selector, trigger: () => true });

    combat.update(0);
    expect(selector).toHaveBeenLastCalledWith(enemy, expect.arrayContaining([expect.objectContaining({ id: "brace" })]));

    combat.update(0);
    expect(selector).toHaveBeenLastCalledWith(enemy, []);
  });

  it("does nothing when the selector returns null", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, { selector: () => null });
    expect(() => combat.update(1500)).not.toThrow();
    expect(player.statusEffects.getActiveIds()).toEqual([]);
  });

  it("works end-to-end with the default trigger and selector", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0); // picks the first available attack
    combat.update(1500);
    randomSpy.mockRestore();
    expect(enemy.statusEffects.has("unstoppable")).toBe(true); // "brace" is available[0] at aggression 3
  });

  it("excludes attacks when the target is beyond max range", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = { x: 500, y: 0, statusEffects: new StatusEffectController() }; // 500 > 8 tiles (384px)
    const selector = vi.fn((_enemy: AggressiveCombatEntity, available: AttackDefinition[]) => available[0] ?? null);
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, { selector });
    combat.update(1500);
    expect(selector).toHaveBeenLastCalledWith(enemy, []);
  });

  it("excludes attacks when line of sight is blocked", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = { x: 100, y: 0, statusEffects: new StatusEffectController() }; // well within range
    const blockedBlocker: LineOfSightBlocker = { isBlocked: () => true };
    const selector = vi.fn((_enemy: AggressiveCombatEntity, available: AttackDefinition[]) => available[0] ?? null);
    const combat = new EnemyCombat(enemy, () => player, blockedBlocker, { selector });
    combat.update(1500);
    expect(selector).toHaveBeenLastCalledWith(enemy, []);
  });

  it("includes attacks when the target is within range and line of sight is clear", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = { x: 100, y: 0, statusEffects: new StatusEffectController() };
    const selector = vi.fn((_enemy: AggressiveCombatEntity, available: AttackDefinition[]) => available[0] ?? null);
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, { selector });
    combat.update(1500);
    expect(selector).toHaveBeenLastCalledWith(enemy, expect.arrayContaining([expect.objectContaining({ id: "brace" })]));
  });
});
