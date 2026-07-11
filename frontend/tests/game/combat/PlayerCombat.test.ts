import { describe, it, expect } from "vitest";
import PlayerCombat, { AttackInput } from "@/game/combat/PlayerCombat";
import { CombatEntity } from "@/game/combat/EnemyCombat";
import StatusEffectController from "@/game/combat/StatusEffectController";
import Health from "@/game/combat/Health";
import { LineOfSightBlocker } from "@/game/combat/lineOfSight";
import { Weapon } from "@/game/combat/Weapon";

const OPEN_BLOCKER: LineOfSightBlocker = { isBlocked: () => false };
const BLOCKED_BLOCKER: LineOfSightBlocker = { isBlocked: () => true };

function makeEntity(x = 0, y = 0): CombatEntity {
  return { x, y, statusEffects: new StatusEffectController(), health: new Health(100) };
}

function makeWeapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: "test-weapon",
    category: "melee",
    damage: 15,
    attackSpeedMs: 500,
    rangeTiles: 1.5,
    attackIds: ["puncture", "battle_focus"],
    ...overrides,
  };
}

function makeInput(overrides: Partial<AttackInput> = {}): AttackInput {
  return {
    isBasicAttackJustPressed: () => false,
    isAbilityJustPressed: () => false,
    ...overrides,
  };
}

describe("PlayerCombat basic attack", () => {
  it("applies slow to the nearest in-range enemy when pressed", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    const input = makeInput({ isBasicAttackJustPressed: () => true });
    const combat = new PlayerCombat(makeWeapon(), self, () => [enemy], OPEN_BLOCKER, input);

    combat.update(0);

    expect(enemy.statusEffects.has("slow")).toBe(true);
  });

  it("does not attack again before attackSpeedMs has elapsed", () => {
    const self = makeEntity();
    let enemy = makeEntity(10, 0);
    const input = makeInput({ isBasicAttackJustPressed: () => true });
    const combat = new PlayerCombat(makeWeapon({ attackSpeedMs: 500 }), self, () => [enemy], OPEN_BLOCKER, input);

    combat.update(0); // first swing lands
    enemy = makeEntity(10, 0); // fresh enemy with no "slow" on it yet
    combat.update(100); // only 100ms since the first swing; cooldown is 500ms, so this swing should be blocked

    expect(enemy.statusEffects.has("slow")).toBe(false);
  });

  it("does not apply slow to an enemy out of range", () => {
    const self = makeEntity();
    const farEnemy = makeEntity(1000, 0);
    const input = makeInput({ isBasicAttackJustPressed: () => true });
    const combat = new PlayerCombat(makeWeapon({ rangeTiles: 1.5 }), self, () => [farEnemy], OPEN_BLOCKER, input);

    combat.update(0);

    expect(farEnemy.statusEffects.has("slow")).toBe(false);
  });

  it("does not apply slow when line of sight is blocked", () => {
    const self = makeEntity();
    const enemy = makeEntity(50, 0); // far enough that hasLineOfSight samples intermediate points
    const input = makeInput({ isBasicAttackJustPressed: () => true });
    const combat = new PlayerCombat(makeWeapon(), self, () => [enemy], BLOCKED_BLOCKER, input);

    combat.update(0);

    expect(enemy.statusEffects.has("slow")).toBe(false);
  });

  it("still starts the cooldown on a whiff (no qualifying enemy)", () => {
    const self = makeEntity();
    let enemies: CombatEntity[] = [makeEntity(1000, 0)]; // out of range
    const input = makeInput({ isBasicAttackJustPressed: () => true });
    const combat = new PlayerCombat(makeWeapon({ attackSpeedMs: 500 }), self, () => enemies, OPEN_BLOCKER, input);

    combat.update(0); // whiff - still starts the 500ms cooldown
    enemies = [makeEntity(10, 0)]; // now within range
    combat.update(400); // only 400ms elapsed, cooldown hasn't finished

    expect(enemies[0].statusEffects.has("slow")).toBe(false);
  });

  it("attacks again once the cooldown has fully elapsed", () => {
    const self = makeEntity();
    const enemies: CombatEntity[] = [makeEntity(1000, 0)]; // out of range, forces a whiff first
    const input = makeInput({ isBasicAttackJustPressed: () => true });
    const combat = new PlayerCombat(makeWeapon({ attackSpeedMs: 500 }), self, () => enemies, OPEN_BLOCKER, input);

    combat.update(0); // whiff, starts the 500ms cooldown
    enemies[0] = makeEntity(10, 0); // move into range before the cooldown elapses
    combat.update(500); // cooldown fully elapses this tick, and the still-pressed input fires again

    expect(enemies[0].statusEffects.has("slow")).toBe(true);
  });
});

describe("PlayerCombat abilities", () => {
  it("fires the ability in slot 0 and applies its target effect to the enemy, not the player", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    const input = makeInput({ isAbilityJustPressed: (slot) => slot === 0 });
    const weapon = makeWeapon({ attackIds: ["puncture"] });
    const combat = new PlayerCombat(weapon, self, () => [enemy], OPEN_BLOCKER, input);

    combat.update(0);

    expect(enemy.statusEffects.has("slow")).toBe(true);
    expect(self.statusEffects.has("slow")).toBe(false);
  });

  it("fires a self-only ability with no enemy present at all", () => {
    const self = makeEntity();
    const input = makeInput({ isAbilityJustPressed: (slot) => slot === 0 });
    const weapon = makeWeapon({ attackIds: ["battle_focus"] });
    const combat = new PlayerCombat(weapon, self, () => [], OPEN_BLOCKER, input);

    combat.update(0);

    expect(self.statusEffects.has("unstoppable")).toBe(true);
  });

  it("does nothing for a missing ability slot", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    const input = makeInput({ isAbilityJustPressed: (slot) => slot === 2 });
    const weapon = makeWeapon({ attackIds: ["puncture"] }); // no slot 2
    const combat = new PlayerCombat(weapon, self, () => [enemy], OPEN_BLOCKER, input);

    expect(() => combat.update(0)).not.toThrow();
    expect(enemy.statusEffects.getActiveIds()).toEqual([]);
  });

  it("does not fire a target-requiring ability when no enemy is in range, and still starts its cooldown", () => {
    const self = makeEntity();
    let enemies: CombatEntity[] = [makeEntity(1000, 0)]; // out of range
    const input = makeInput({ isAbilityJustPressed: (slot) => slot === 0 });
    const weapon = makeWeapon({ attackIds: ["puncture"], rangeTiles: 1.5 }); // puncture cooldown: 3000ms
    const combat = new PlayerCombat(weapon, self, () => enemies, OPEN_BLOCKER, input);

    combat.update(0); // whiff, starts puncture's 3000ms cooldown
    enemies = [makeEntity(10, 0)]; // now within range
    combat.update(1000); // only 1000ms elapsed, cooldown hasn't finished

    expect(enemies[0].statusEffects.has("slow")).toBe(false);
  });

  it("keeps each ability's cooldown independent of the others", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    let pressedSlot: 0 | 1 | null = 0;
    const input = makeInput({ isAbilityJustPressed: (slot) => slot === pressedSlot });
    const weapon = makeWeapon({ attackIds: ["puncture", "intimidating_strike"] });
    const combat = new PlayerCombat(weapon, self, () => [enemy], OPEN_BLOCKER, input);

    combat.update(0); // fires puncture (slot 0), starts its cooldown
    pressedSlot = 1;
    combat.update(0); // intimidating_strike (slot 1) should still fire immediately

    expect(enemy.statusEffects.has("suppressed")).toBe(true);
  });

  it("keeps ability cooldowns independent of the basic attack cooldown", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    const input = makeInput({
      isBasicAttackJustPressed: () => true,
      isAbilityJustPressed: (slot) => slot === 0,
    });
    const weapon = makeWeapon({ attackIds: ["puncture"] });
    const combat = new PlayerCombat(weapon, self, () => [enemy], OPEN_BLOCKER, input);

    combat.update(0); // basic attack fires and starts its own cooldown; ability fires too

    expect(enemy.statusEffects.has("slow")).toBe(true); // from either/both - just confirming no crash/interference
  });
});

describe("PlayerCombat damage", () => {
  it("the basic attack deals the wielder's weapon.damage to the nearest enemy", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    const input = makeInput({ isBasicAttackJustPressed: () => true });
    const weapon = makeWeapon({ damage: 15 });
    const combat = new PlayerCombat(weapon, self, () => [enemy], OPEN_BLOCKER, input);

    combat.update(0);

    expect(enemy.health.getRatio()).toBe(0.85);
  });

  it("an ability with an explicit damage amount deals exactly that amount, ignoring weapon.damage", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    const input = makeInput({ isAbilityJustPressed: (slot) => slot === 0 });
    const weapon = makeWeapon({ attackIds: ["puncture"], damage: 999 });
    const combat = new PlayerCombat(weapon, self, () => [enemy], OPEN_BLOCKER, input);

    combat.update(0);

    expect(enemy.health.getRatio()).toBe(0.88);
  });

  it("a self-only ability deals no damage to anyone", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    const input = makeInput({ isAbilityJustPressed: (slot) => slot === 0 });
    const weapon = makeWeapon({ attackIds: ["battle_focus"] });
    const combat = new PlayerCombat(weapon, self, () => [enemy], OPEN_BLOCKER, input);

    combat.update(0);

    expect(self.health.getRatio()).toBe(1);
    expect(enemy.health.getRatio()).toBe(1);
  });
});
