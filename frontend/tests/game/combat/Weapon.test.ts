import { describe, it, expect, vi } from "vitest";
import { CATEGORY_BASE_STATS, randomAttackCount, randomWeaponCategory, pickUnique, generateWeapon } from "@/game/combat/Weapon";
import { WEAPON_ATTACKS } from "@/game/combat/WeaponAttack";

describe("CATEGORY_BASE_STATS", () => {
  it("gives melee a shorter range, faster speed, and higher damage than longMelee", () => {
    expect(CATEGORY_BASE_STATS.melee.rangeTiles).toBeLessThan(CATEGORY_BASE_STATS.longMelee.rangeTiles);
    expect(CATEGORY_BASE_STATS.melee.attackSpeedMs).toBeLessThan(CATEGORY_BASE_STATS.longMelee.attackSpeedMs);
    expect(CATEGORY_BASE_STATS.melee.damage).toBeGreaterThan(CATEGORY_BASE_STATS.longMelee.damage);
  });
});

describe("randomWeaponCategory", () => {
  it("returns melee when the roll is below 0.5", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.1);
    expect(randomWeaponCategory()).toBe("melee");
    spy.mockRestore();
  });

  it("returns longMelee when the roll is 0.5 or above", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(randomWeaponCategory()).toBe("longMelee");
    spy.mockRestore();
  });
});

describe("randomAttackCount", () => {
  it("returns 1 when the roll is in the bottom 60%", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.1);
    expect(randomAttackCount()).toBe(1);
    spy.mockRestore();
  });

  it("returns 2 when the roll is in the next 30%", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.7);
    expect(randomAttackCount()).toBe(2);
    spy.mockRestore();
  });

  it("returns 3 when the roll is in the top 10%", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.95);
    expect(randomAttackCount()).toBe(3);
    spy.mockRestore();
  });
});

describe("pickUnique", () => {
  it("picks distinct items without replacement", () => {
    const values = [0.3, 0.1];
    let call = 0;
    const spy = vi.spyOn(Math, "random").mockImplementation(() => values[call++]);
    const picked = pickUnique(["a", "b", "c", "d"], 2);
    spy.mockRestore();
    expect(picked).toEqual(["b", "a"]);
  });

  it("returns all items when count exceeds the available pool size", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    const picked = pickUnique(["a", "b"], 5);
    spy.mockRestore();
    expect(picked.length).toBe(2);
    expect(new Set(picked).size).toBe(2);
  });
});

describe("generateWeapon", () => {
  it("applies the category's base stats", () => {
    const weapon = generateWeapon("melee");
    expect(weapon.category).toBe("melee");
    expect(weapon.damage).toBe(CATEGORY_BASE_STATS.melee.damage);
    expect(weapon.attackSpeedMs).toBe(CATEGORY_BASE_STATS.melee.attackSpeedMs);
    expect(weapon.rangeTiles).toBe(CATEGORY_BASE_STATS.melee.rangeTiles);
  });

  it("attaches between 1 and 3 unique attack ids, all drawn from WEAPON_ATTACKS", () => {
    const weapon = generateWeapon("longMelee");
    expect(weapon.attackIds.length).toBeGreaterThanOrEqual(1);
    expect(weapon.attackIds.length).toBeLessThanOrEqual(3);
    expect(new Set(weapon.attackIds).size).toBe(weapon.attackIds.length);
    const validIds = new Set(WEAPON_ATTACKS.map((a) => a.id));
    for (const id of weapon.attackIds) {
      expect(validIds.has(id)).toBe(true);
    }
  });

  it("gives each generated weapon a unique id", () => {
    const a = generateWeapon("melee");
    const b = generateWeapon("melee");
    expect(a.id).not.toBe(b.id);
  });
});
