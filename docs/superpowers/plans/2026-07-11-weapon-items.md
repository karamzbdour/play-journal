# Weapon Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weapon data model and generation function - weapons hold 1-3 randomly-selected attacks (weighted toward fewer), with fixed base stats per category (melee, longMelee). Data model and generation only - no player-wielding, hit detection, or damage consumption.

**Architecture:** Two new catalog files (`StatusEffect.ts` gains two entries, `WeaponAttack.ts` is a new weapon-specific attack catalog reusing `AttackEffectApplication`) plus `Weapon.ts` (category base stats + weighted/unique-selection generation). All pure TypeScript, no Phaser dependency, following the exact pattern already established by `Attack.ts`/`StatusEffect.ts`/`EnemyCombat.ts`.

**Tech Stack:** TypeScript, Vitest (already set up).

## Global Constraints

- `CATEGORY_BASE_STATS` are fixed per category (`melee`, `longMelee`), not rolled ranges - what's randomized per generated weapon is which attacks (and how many) get attached, not the numeric stats.
- Attack count is 1-3, weighted toward fewer (~60% / 30% / 10% for 1/2/3).
- Attacks are selected without replacement - a weapon never has the same attack id twice.
- `WeaponAttackDefinition` has no per-attack cooldown field - nothing consumes per-attack timing yet, unlike enemy attacks.
- Out of scope for this plan: player-wielding, an attack input/action, hit detection, a damage/health system, ranged weapons/projectiles, weapon sprites.
- Weapon ids use `crypto.randomUUID()` - a standard Web/Node API, no new dependency.
- Nothing in this plan touches `DungeonScene.ts`, Phaser, or any rendering path - `vitest`/`tsc` verification only, no browser check needed.

---

### Task 1: `StatusEffect.ts` — add `bonus_damage` and `charge_time`

**Files:**
- Modify: `frontend/src/game/combat/StatusEffect.ts` (full file, 34 lines)
- Modify: `frontend/src/game/combat/StatusEffect.test.ts` (full file, 24 lines)

**Interfaces:**
- Produces: `STATUS_EFFECTS` gains keys `bonus_damage` (tags `["buff"]`, `magnitude: 10`) and `charge_time` (tags `["debuff"]`, no magnitude).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `frontend/src/game/combat/StatusEffect.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run (from `frontend/`): `npx vitest run src/game/combat/StatusEffect.test.ts`
Expected: FAIL - the two new tests fail (`Cannot read properties of undefined`), the other 4 still pass.

- [ ] **Step 3: Implement**

Replace the full contents of `frontend/src/game/combat/StatusEffect.ts` with:

```ts
export type EffectTag = "cc" | "buff" | "debuff";

export interface StatusEffectDefinition {
  id: string;
  label: string;
  color: string;
  tags: EffectTag[];
  blocksTags?: EffectTag[];
  magnitude?: number;
}

export const STATUS_EFFECTS: Record<string, StatusEffectDefinition> = {
  slow: {
    id: "slow",
    label: "SLOW",
    color: "#38bdf8",
    tags: ["cc", "debuff"],
    magnitude: 0.5,
  },
  suppressed: {
    id: "suppressed",
    label: "SUPPRESSED",
    color: "#a855f7",
    tags: ["cc", "debuff"],
  },
  unstoppable: {
    id: "unstoppable",
    label: "UNSTOPPABLE",
    color: "#facc15",
    tags: ["buff"],
    blocksTags: ["cc"],
  },
  bonus_damage: {
    id: "bonus_damage",
    label: "BONUS DMG",
    color: "#f87171",
    tags: ["buff"],
    magnitude: 10,
  },
  charge_time: {
    id: "charge_time",
    label: "CHARGING",
    color: "#fb923c",
    tags: ["debuff"],
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/game/combat/StatusEffect.test.ts`
Expected: PASS - 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/StatusEffect.ts frontend/src/game/combat/StatusEffect.test.ts
git commit -m "Add bonus_damage and charge_time status effects"
```

---

### Task 2: `WeaponAttack.ts`

**Files:**
- Create: `frontend/src/game/combat/WeaponAttack.ts`
- Test: `frontend/src/game/combat/WeaponAttack.test.ts`

**Interfaces:**
- Consumes: `AttackEffectApplication` from `./Attack` (existing); `STATUS_EFFECTS` from `./StatusEffect` (Task 1, for the catalog cross-check test).
- Produces: `WeaponAttackDefinition { id, name, effects: AttackEffectApplication[] }`, `WEAPON_ATTACKS: WeaponAttackDefinition[]` with ids `quick_slash`, `puncture`, `intimidating_strike`, `battle_focus`, `power_swing`, `heavy_strike`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/game/combat/WeaponAttack.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/game/combat/WeaponAttack.test.ts`
Expected: FAIL - `Cannot find module './WeaponAttack'`.

- [ ] **Step 3: Implement**

Create `frontend/src/game/combat/WeaponAttack.ts`:

```ts
import { AttackEffectApplication } from "./Attack";

export interface WeaponAttackDefinition {
  id: string;
  name: string;
  effects: AttackEffectApplication[];
}

export const WEAPON_ATTACKS: WeaponAttackDefinition[] = [
  { id: "quick_slash", name: "Quick Slash", effects: [] },
  { id: "puncture", name: "Puncture", effects: [{ effectId: "slow", target: "target", durationMs: 2000 }] },
  {
    id: "intimidating_strike",
    name: "Intimidating Strike",
    effects: [{ effectId: "suppressed", target: "target", durationMs: 2500 }],
  },
  {
    id: "battle_focus",
    name: "Battle Focus",
    effects: [{ effectId: "unstoppable", target: "self", durationMs: 3000 }],
  },
  {
    id: "power_swing",
    name: "Power Swing",
    effects: [{ effectId: "bonus_damage", target: "self", durationMs: 2000 }],
  },
  {
    id: "heavy_strike",
    name: "Heavy Strike",
    effects: [{ effectId: "charge_time", target: "self", durationMs: 1200 }],
  },
];
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/game/combat/WeaponAttack.test.ts`
Expected: PASS - 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/WeaponAttack.ts frontend/src/game/combat/WeaponAttack.test.ts
git commit -m "Add weapon-specific attack catalog"
```

---

### Task 3: `Weapon.ts` — categories, base stats, generation

**Files:**
- Create: `frontend/src/game/combat/Weapon.ts`
- Test: `frontend/src/game/combat/Weapon.test.ts`

**Interfaces:**
- Consumes: `WEAPON_ATTACKS`, `WeaponAttackDefinition` from `./WeaponAttack` (Task 2).
- Produces: `WeaponCategory = "melee" | "longMelee"`, `Weapon { id, category, damage, attackSpeedMs, rangeTiles, attackIds: string[] }`, `CATEGORY_BASE_STATS: Record<WeaponCategory, { damage, attackSpeedMs, rangeTiles }>`, `randomAttackCount(): number`, `pickUnique<T>(items: T[], count: number): T[]`, `generateWeapon(category: WeaponCategory): Weapon`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/game/combat/Weapon.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { CATEGORY_BASE_STATS, randomAttackCount, pickUnique, generateWeapon } from "./Weapon";
import { WEAPON_ATTACKS } from "./WeaponAttack";

describe("CATEGORY_BASE_STATS", () => {
  it("gives melee a shorter range, faster speed, and higher damage than longMelee", () => {
    expect(CATEGORY_BASE_STATS.melee.rangeTiles).toBeLessThan(CATEGORY_BASE_STATS.longMelee.rangeTiles);
    expect(CATEGORY_BASE_STATS.melee.attackSpeedMs).toBeLessThan(CATEGORY_BASE_STATS.longMelee.attackSpeedMs);
    expect(CATEGORY_BASE_STATS.melee.damage).toBeGreaterThan(CATEGORY_BASE_STATS.longMelee.damage);
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/game/combat/Weapon.test.ts`
Expected: FAIL - `Cannot find module './Weapon'`.

- [ ] **Step 3: Implement**

Create `frontend/src/game/combat/Weapon.ts`:

```ts
import { WEAPON_ATTACKS } from "./WeaponAttack";

export type WeaponCategory = "melee" | "longMelee";

export interface Weapon {
  id: string;
  category: WeaponCategory;
  damage: number;
  attackSpeedMs: number;
  rangeTiles: number;
  attackIds: string[];
}

interface CategoryBaseStats {
  damage: number;
  attackSpeedMs: number;
  rangeTiles: number;
}

export const CATEGORY_BASE_STATS: Record<WeaponCategory, CategoryBaseStats> = {
  melee: { damage: 15, attackSpeedMs: 500, rangeTiles: 1.5 },
  longMelee: { damage: 10, attackSpeedMs: 800, rangeTiles: 3 },
};

// Weighted toward fewer attacks: 1 (60%), 2 (30%), 3 (10%).
export function randomAttackCount(): number {
  const roll = Math.random();
  if (roll < 0.6) return 1;
  if (roll < 0.9) return 2;
  return 3;
}

// Picks `count` unique items from `items` without replacement.
export function pickUnique<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool[index]);
    pool.splice(index, 1);
  }
  return picked;
}

export function generateWeapon(category: WeaponCategory): Weapon {
  const base = CATEGORY_BASE_STATS[category];
  const count = randomAttackCount();
  const attackIds = pickUnique(WEAPON_ATTACKS, count).map((a) => a.id);

  return {
    id: crypto.randomUUID(),
    category,
    ...base,
    attackIds,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/game/combat/Weapon.test.ts`
Expected: PASS - 9 tests passed (1 `CATEGORY_BASE_STATS` + 3 `randomAttackCount` + 2 `pickUnique` + 3 `generateWeapon`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/Weapon.ts frontend/src/game/combat/Weapon.test.ts
git commit -m "Add weapon data model and weighted generation"
```

---

### Task 4: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated test suite**

Run (from `frontend/`): `npx vitest run`
Expected: PASS - all tests, including the new StatusEffect (6), WeaponAttack (3), and Weapon (9) suites, plus everything pre-existing.

- [ ] **Step 2: Type-check**

Run (from `frontend/`): `npx tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Report results**

No commit for this task - it's verification only. Report the total test count passed and confirm `tsc` is clean. No browser/build verification needed - this plan added no Phaser-dependent code.
