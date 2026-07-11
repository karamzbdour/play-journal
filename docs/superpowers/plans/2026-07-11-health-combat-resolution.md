# Health & Combat Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both the player and enemies real HP, make every existing attack/ability actually deal damage (via a new composable "damage" component alongside the existing "status effect" component), and resolve combat to a conclusion - enemies are removed on death, the player freezes with a "YOU DIED" overlay on death, and both get a visible HP bar.

**Architecture:** A new `Health` class (mirrors `StatusEffectController`'s role: owned by `Player`/`Enemy` via composition). A new shared `AttackComponent` union type (`{kind:"status",...} | {kind:"damage",...}`) replaces the old status-effect-only `AttackEffectApplication`, used by both `Attack.ts` (enemy attacks) and `WeaponAttack.ts` (player abilities + a newly-promoted `BASIC_ATTACK`). A single `resolveAttackComponents` function replaces the duplicated effect-application loops in `EnemyCombat` and `PlayerCombat`. `CombatEntity` gains a `health` field, which ripples into every real and test construction site. `DungeonScene` gains death handling and HP bars via `EntityLabel`.

**Tech Stack:** TypeScript, Phaser 3, Vitest (frontend workspace at `frontend/`, all commands below run with `frontend/` as the working directory).

## Global Constraints

- Damage is a component in an attack's `effects` array (`{kind:"damage", target, amount?}`), not a separate flat field - so a future damage-dealing ability is built the same way a status-effect ability is: add a component to its `effects` list. (Design: "Damage becomes a component")
- The player's basic attack (SPACE) is promoted to a real definition, `BASIC_ATTACK`, whose damage component omits `amount` so it falls back to the wielder's `weapon.damage`. Ability damage components always specify their own explicit `amount`, ignoring `weapon.damage`. Enemy attack damage components always specify an explicit `amount` too (enemies have no `weapon` to fall back to).
- Self-only components (`battle_focus`, `power_swing`, `heavy_strike`, `brace`) get no damage component - unchanged behavior, no damage dealt.
- `bonus_damage` stays inert (cosmetic only) - out of scope for this feature.
- Player max HP: 100. Demo enemy max HP: 50.
- Damage amounts: `quick_slash`=10, `puncture`=12, `intimidating_strike`=8, `nagging_reminder`=10, `silencing_glare`=14.
- Player death is in-canvas only (a "YOU DIED" text, scene frozen) - no React/GameComponent event wiring.
- The HP bar is thicker than the existing status-duration bars: 6px tall / 44px wide, vs. the status bars' 3px / 40px.
- Every task must leave `npx tsc --noEmit` (aside from the pre-existing unrelated `journal/page.tsx` error) and `npx vitest run` clean before moving to the next task.

---

### Task 1: `Health` component

**Files:**
- Create: `frontend/src/game/combat/Health.ts`
- Test: `frontend/tests/game/combat/Health.test.ts`

**Interfaces:**
- Produces: `export default class Health { constructor(max: number); takeDamage(amount: number): void; get isDead(): boolean; getRatio(): number; }`. Consumed by every later task in this plan.

- [ ] **Step 1: Write the failing tests**

Create `frontend/tests/game/combat/Health.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import Health from "@/game/combat/Health";

describe("Health", () => {
  it("starts at full ratio and not dead", () => {
    const health = new Health(100);
    expect(health.getRatio()).toBe(1);
    expect(health.isDead).toBe(false);
  });

  it("reduces the ratio as damage is taken", () => {
    const health = new Health(100);
    health.takeDamage(25);
    expect(health.getRatio()).toBe(0.75);
    expect(health.isDead).toBe(false);
  });

  it("clamps at 0 and reports dead once damage meets or exceeds max", () => {
    const health = new Health(50);
    health.takeDamage(1000);
    expect(health.getRatio()).toBe(0);
    expect(health.isDead).toBe(true);
  });

  it("accumulates damage across multiple hits", () => {
    const health = new Health(100);
    health.takeDamage(30);
    health.takeDamage(30);
    expect(health.getRatio()).toBe(0.4);
    expect(health.isDead).toBe(false);
  });

  it("reports dead exactly at 0 remaining", () => {
    const health = new Health(40);
    health.takeDamage(40);
    expect(health.isDead).toBe(true);
    expect(health.getRatio()).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run tests/game/combat/Health.test.ts`

Expected: FAIL - `Cannot find module '@/game/combat/Health'`.

- [ ] **Step 3: Implement `Health`**

Create `frontend/src/game/combat/Health.ts`:

```ts
export default class Health {
  private current: number;

  constructor(public readonly max: number) {
    this.current = max;
  }

  takeDamage(amount: number): void {
    this.current = Math.max(0, this.current - amount);
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  getRatio(): number {
    return this.current / this.max;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run tests/game/combat/Health.test.ts`

Expected: PASS - all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/Health.ts frontend/tests/game/combat/Health.test.ts
git commit -m "Add Health component"
```

---

### Task 2: `AttackComponent` union type and shared resolver

**Files:**
- Create: `frontend/src/game/combat/AttackComponent.ts`
- Test: `frontend/tests/game/combat/AttackComponent.test.ts`

**Interfaces:**
- Consumes: `Health` (Task 1); existing `StatusEffectController` (`statusEffects.apply(effectId, durationMs)`).
- Produces: `export interface StatusEffectComponent { kind: "status"; effectId: string; target: "self" | "target"; durationMs: number }`, `export interface DamageComponent { kind: "damage"; target: "self" | "target"; amount?: number }`, `export type AttackComponent = StatusEffectComponent | DamageComponent`, `export interface ResolvableEntity { statusEffects: StatusEffectController; health: Health }`, `export function resolveAttackComponents(components: AttackComponent[], self: ResolvableEntity, target: ResolvableEntity | null, fallbackDamage: number): void`. Task 3 and 4 use `AttackComponent` for their catalogs; Task 5 uses `resolveAttackComponents` in both `EnemyCombat` and `PlayerCombat`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/tests/game/combat/AttackComponent.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveAttackComponents, AttackComponent, ResolvableEntity } from "@/game/combat/AttackComponent";
import StatusEffectController from "@/game/combat/StatusEffectController";
import Health from "@/game/combat/Health";

function makeEntity(): ResolvableEntity {
  return { statusEffects: new StatusEffectController(), health: new Health(100) };
}

describe("resolveAttackComponents", () => {
  it("applies a self-targeted status effect to self, not target", () => {
    const self = makeEntity();
    const target = makeEntity();
    const components: AttackComponent[] = [{ kind: "status", effectId: "unstoppable", target: "self", durationMs: 1000 }];

    resolveAttackComponents(components, self, target, 0);

    expect(self.statusEffects.has("unstoppable")).toBe(true);
    expect(target.statusEffects.has("unstoppable")).toBe(false);
  });

  it("applies a target-targeted status effect to target, not self", () => {
    const self = makeEntity();
    const target = makeEntity();
    const components: AttackComponent[] = [{ kind: "status", effectId: "slow", target: "target", durationMs: 1000 }];

    resolveAttackComponents(components, self, target, 0);

    expect(target.statusEffects.has("slow")).toBe(true);
    expect(self.statusEffects.has("slow")).toBe(false);
  });

  it("deals its own explicit damage amount to the target", () => {
    const self = makeEntity();
    const target = makeEntity();
    const components: AttackComponent[] = [{ kind: "damage", target: "target", amount: 12 }];

    resolveAttackComponents(components, self, target, 999);

    expect(target.health.getRatio()).toBe(0.88);
  });

  it("falls back to the provided fallback damage when amount is omitted", () => {
    const self = makeEntity();
    const target = makeEntity();
    const components: AttackComponent[] = [{ kind: "damage", target: "target" }];

    resolveAttackComponents(components, self, target, 20);

    expect(target.health.getRatio()).toBe(0.8);
  });

  it("deals damage to self when the component targets self", () => {
    const self = makeEntity();
    const target = makeEntity();
    const components: AttackComponent[] = [{ kind: "damage", target: "self", amount: 10 }];

    resolveAttackComponents(components, self, target, 0);

    expect(self.health.getRatio()).toBe(0.9);
    expect(target.health.getRatio()).toBe(1);
  });

  it("skips a target-directed component when there is no target", () => {
    const self = makeEntity();
    const components: AttackComponent[] = [{ kind: "damage", target: "target", amount: 10 }];

    expect(() => resolveAttackComponents(components, self, null, 0)).not.toThrow();
    expect(self.health.getRatio()).toBe(1);
  });

  it("resolves multiple components in order", () => {
    const self = makeEntity();
    const target = makeEntity();
    const components: AttackComponent[] = [
      { kind: "damage", target: "target", amount: 10 },
      { kind: "status", effectId: "slow", target: "target", durationMs: 1000 },
    ];

    resolveAttackComponents(components, self, target, 0);

    expect(target.health.getRatio()).toBe(0.9);
    expect(target.statusEffects.has("slow")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run tests/game/combat/AttackComponent.test.ts`

Expected: FAIL - `Cannot find module '@/game/combat/AttackComponent'`.

- [ ] **Step 3: Implement `AttackComponent.ts`**

Create `frontend/src/game/combat/AttackComponent.ts`:

```ts
import StatusEffectController from "./StatusEffectController";
import Health from "./Health";

export interface StatusEffectComponent {
  kind: "status";
  effectId: string;
  target: "self" | "target";
  durationMs: number;
}

export interface DamageComponent {
  kind: "damage";
  target: "self" | "target";
  amount?: number;
}

export type AttackComponent = StatusEffectComponent | DamageComponent;

export interface ResolvableEntity {
  statusEffects: StatusEffectController;
  health: Health;
}

export function resolveAttackComponents(
  components: AttackComponent[],
  self: ResolvableEntity,
  target: ResolvableEntity | null,
  fallbackDamage: number
): void {
  for (const component of components) {
    const recipient = component.target === "self" ? self : target;
    if (!recipient) continue;

    if (component.kind === "damage") {
      recipient.health.takeDamage(component.amount ?? fallbackDamage);
    } else {
      recipient.statusEffects.apply(component.effectId, component.durationMs);
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run tests/game/combat/AttackComponent.test.ts`

Expected: PASS - all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/AttackComponent.ts frontend/tests/game/combat/AttackComponent.test.ts
git commit -m "Add AttackComponent union type and shared resolver"
```

---

### Task 3: Update the enemy attack catalog (`Attack.ts`)

**Files:**
- Modify: `frontend/src/game/combat/Attack.ts`
- Test: `frontend/tests/game/combat/Attack.test.ts`

**Interfaces:**
- Consumes: `AttackComponent` from `frontend/src/game/combat/AttackComponent.ts` (Task 2).
- Produces: `AttackDefinition.effects: AttackComponent[]` (was `AttackEffectApplication[]`). `ATTACKS` entries now use `{kind: "status", ...}` for existing status effects, and `nagging_reminder`/`silencing_glare` each gain a `{kind: "damage", target: "target", amount}` component. Task 5 (`EnemyCombat.ts`) consumes `ATTACKS` and resolves `effects` via `resolveAttackComponents`.

- [ ] **Step 1: Update the test file's assertions for the new component shape**

Replace the full contents of `frontend/tests/game/combat/Attack.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run tests/game/combat/Attack.test.ts`

Expected: FAIL - `component.kind` is `undefined` on every existing entry (no `kind` field yet), and the new damage-component tests fail since no damage components exist yet.

- [ ] **Step 3: Update `Attack.ts`**

Replace the full contents of `frontend/src/game/combat/Attack.ts`:

```ts
import { AttackComponent } from "./AttackComponent";

export interface AttackDefinition {
  id: string;
  name: string;
  minAggression: number;
  cooldownMs: number;
  effects: AttackComponent[];
  requiresLineOfSight?: boolean;
  maxRangeTiles?: number;
}

export const ATTACKS: AttackDefinition[] = [
  {
    id: "brace",
    name: "Brace",
    minAggression: 1,
    cooldownMs: 5000,
    effects: [{ kind: "status", effectId: "unstoppable", target: "self", durationMs: 3000 }],
    requiresLineOfSight: true,
    maxRangeTiles: 8,
  },
  {
    id: "nagging_reminder",
    name: "Nagging Reminder",
    minAggression: 2,
    cooldownMs: 4000,
    effects: [
      { kind: "status", effectId: "slow", target: "target", durationMs: 2000 },
      { kind: "damage", target: "target", amount: 10 },
    ],
    requiresLineOfSight: true,
    maxRangeTiles: 8,
  },
  {
    id: "silencing_glare",
    name: "Silencing Glare",
    minAggression: 3,
    cooldownMs: 6000,
    effects: [
      { kind: "status", effectId: "suppressed", target: "target", durationMs: 2500 },
      { kind: "damage", target: "target", amount: 14 },
    ],
    requiresLineOfSight: true,
    maxRangeTiles: 8,
  },
];
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run tests/game/combat/Attack.test.ts`

Expected: PASS - all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/Attack.ts frontend/tests/game/combat/Attack.test.ts
git commit -m "Move enemy attacks to the AttackComponent shape and add damage"
```

---

### Task 4: Update the weapon ability catalog and promote the basic attack (`WeaponAttack.ts`)

**Files:**
- Modify: `frontend/src/game/combat/WeaponAttack.ts`
- Test: `frontend/tests/game/combat/WeaponAttack.test.ts`

**Interfaces:**
- Consumes: `AttackComponent` from `frontend/src/game/combat/AttackComponent.ts` (Task 2).
- Produces: `WeaponAttackDefinition.effects: AttackComponent[]`. `WEAPON_ATTACKS` entries gain `kind` and damage components on `quick_slash`/`puncture`/`intimidating_strike`. New export `BASIC_ATTACK: WeaponAttackDefinition` (not part of `WEAPON_ATTACKS`). Task 5 (`PlayerCombat.ts`) imports both `WEAPON_ATTACKS` and `BASIC_ATTACK`.

- [ ] **Step 1: Update the test file**

Replace the full contents of `frontend/tests/game/combat/WeaponAttack.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run tests/game/combat/WeaponAttack.test.ts`

Expected: FAIL - `BASIC_ATTACK` isn't exported yet, and existing entries lack `kind`.

- [ ] **Step 3: Update `WeaponAttack.ts`**

Replace the full contents of `frontend/src/game/combat/WeaponAttack.ts`:

```ts
import { AttackComponent } from "./AttackComponent";

export interface WeaponAttackDefinition {
  id: string;
  name: string;
  cooldownMs: number;
  effects: AttackComponent[];
}

export const WEAPON_ATTACKS: WeaponAttackDefinition[] = [
  {
    id: "quick_slash",
    name: "Quick Slash",
    cooldownMs: 2000,
    effects: [{ kind: "damage", target: "target", amount: 10 }],
  },
  {
    id: "puncture",
    name: "Puncture",
    cooldownMs: 3000,
    effects: [
      { kind: "status", effectId: "slow", target: "target", durationMs: 2000 },
      { kind: "damage", target: "target", amount: 12 },
    ],
  },
  {
    id: "intimidating_strike",
    name: "Intimidating Strike",
    cooldownMs: 4000,
    effects: [
      { kind: "status", effectId: "suppressed", target: "target", durationMs: 2500 },
      { kind: "damage", target: "target", amount: 8 },
    ],
  },
  {
    id: "battle_focus",
    name: "Battle Focus",
    cooldownMs: 5000,
    effects: [{ kind: "status", effectId: "unstoppable", target: "self", durationMs: 3000 }],
  },
  {
    id: "power_swing",
    name: "Power Swing",
    cooldownMs: 4000,
    effects: [{ kind: "status", effectId: "bonus_damage", target: "self", durationMs: 2000 }],
  },
  {
    id: "heavy_strike",
    name: "Heavy Strike",
    cooldownMs: 3000,
    effects: [{ kind: "status", effectId: "charge_time", target: "self", durationMs: 1200 }],
  },
];

// The player's default attack (SPACE) - not part of the randomized `attackIds` pool.
// Its damage component omits `amount`, so PlayerCombat resolves it against the wielder's
// weapon.damage instead of a fixed number, keeping weapon.damage a meaningful, buffable stat.
export const BASIC_ATTACK: WeaponAttackDefinition = {
  id: "basic_attack",
  name: "Basic Attack",
  cooldownMs: 0, // unused - PlayerCombat gates this by weapon.attackSpeedMs instead
  effects: [
    { kind: "damage", target: "target" },
    { kind: "status", effectId: "slow", target: "target", durationMs: 500 },
  ],
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run tests/game/combat/WeaponAttack.test.ts`

Expected: PASS - all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/WeaponAttack.ts frontend/tests/game/combat/WeaponAttack.test.ts
git commit -m "Move weapon abilities to the AttackComponent shape and add BASIC_ATTACK"
```

---

### Task 5: Wire `health` through `CombatEntity`, both combat systems, `Player`/`Enemy`, and `DungeonScene`

This is one atomic task because `CombatEntity` (defined in `EnemyCombat.ts`) is a structural type used by `PlayerCombat.ts`, `DungeonScene.ts`, and two test files - adding a required `health` field to it means every construction site must gain a `health` value in the same change, or the project stops typechecking.

**Files:**
- Modify: `frontend/src/game/combat/EnemyCombat.ts`
- Modify: `frontend/src/game/combat/PlayerCombat.ts`
- Modify: `frontend/src/game/entities/Player.ts`
- Modify: `frontend/src/game/entities/Enemy.ts`
- Modify: `frontend/src/game/scenes/DungeonScene.ts`
- Modify: `frontend/tests/game/combat/EnemyCombat.test.ts`
- Modify: `frontend/tests/game/combat/PlayerCombat.test.ts`

**Interfaces:**
- Consumes: `Health` (Task 1), `resolveAttackComponents` (Task 2), `BASIC_ATTACK` (Task 4).
- Produces: `CombatEntity` now includes `health: Health`. `Player.health: Health` (max 100). `Enemy` constructor gains a required `maxHp: number` parameter (after `aggressionLevel`) and exposes `health: Health`. Task 6 (`EntityLabel`) and Task 7 (death handling) both read `.health` off `Player`/`Enemy`.

- [ ] **Step 1: Update `EnemyCombat.ts`**

Add imports and the `health` field to `CombatEntity`. In `frontend/src/game/combat/EnemyCombat.ts`, replace:

```ts
import { ATTACKS, AttackDefinition } from "./Attack";
import StatusEffectController from "./StatusEffectController";
import { LineOfSightBlocker, isWithinRange, hasLineOfSight } from "./lineOfSight";
import { TILE_SIZE } from "../constants";

export interface CombatEntity {
  x: number;
  y: number;
  statusEffects: StatusEffectController;
}
```

with:

```ts
import { ATTACKS, AttackDefinition } from "./Attack";
import StatusEffectController from "./StatusEffectController";
import Health from "./Health";
import { resolveAttackComponents } from "./AttackComponent";
import { LineOfSightBlocker, isWithinRange, hasLineOfSight } from "./lineOfSight";
import { TILE_SIZE } from "../constants";

export interface CombatEntity {
  x: number;
  y: number;
  statusEffects: StatusEffectController;
  health: Health;
}
```

Then replace the resolution loop at the end of `update()`:

```ts
    this.cooldowns.set(chosen.id, chosen.cooldownMs);

    for (const application of chosen.effects) {
      const recipient = application.target === "self" ? this.enemy : target;
      recipient.statusEffects.apply(application.effectId, application.durationMs);
    }
```

with:

```ts
    this.cooldowns.set(chosen.id, chosen.cooldownMs);
    resolveAttackComponents(chosen.effects, this.enemy, target, 0);
```

(`fallbackDamage` is `0` here because every enemy attack's damage component already specifies an explicit `amount` - there's no enemy-side equivalent of `weapon.damage` to fall back to.)

- [ ] **Step 2: Update `PlayerCombat.ts`**

Replace the imports and remove the old basic-attack constants. Replace:

```ts
import type Phaser from "phaser";
import { CombatEntity } from "./EnemyCombat";
import { LineOfSightBlocker, hasLineOfSight } from "./lineOfSight";
import { Weapon } from "./Weapon";
import { WEAPON_ATTACKS } from "./WeaponAttack";
import { TILE_SIZE } from "../constants";

const BASIC_ATTACK_EFFECT_ID = "slow";
const BASIC_ATTACK_EFFECT_DURATION_MS = 500;
```

with:

```ts
import type Phaser from "phaser";
import { CombatEntity } from "./EnemyCombat";
import { LineOfSightBlocker, hasLineOfSight } from "./lineOfSight";
import { Weapon } from "./Weapon";
import { WEAPON_ATTACKS, BASIC_ATTACK } from "./WeaponAttack";
import { resolveAttackComponents } from "./AttackComponent";
import { TILE_SIZE } from "../constants";
```

Then replace `tryBasicAttack` and `tryAbility`:

```ts
  private tryBasicAttack(): void {
    if (this.basicAttackCooldownMs > 0) return;
    this.basicAttackCooldownMs = this.weapon.attackSpeedMs;

    const target = findNearestTarget(
      this.self,
      this.getEnemies(),
      this.weapon.rangeTiles * TILE_SIZE,
      this.blocker
    );
    if (!target) return;
    target.statusEffects.apply(BASIC_ATTACK_EFFECT_ID, BASIC_ATTACK_EFFECT_DURATION_MS);
  }

  private tryAbility(slot: 0 | 1 | 2): void {
    const attackId = this.weapon.attackIds[slot];
    if (!attackId) return;
    if ((this.abilityCooldowns.get(attackId) ?? 0) > 0) return;

    const definition = WEAPON_ATTACKS.find((a) => a.id === attackId);
    if (!definition) return;

    this.abilityCooldowns.set(attackId, definition.cooldownMs);

    const requiresTarget = definition.effects.some((application) => application.target === "target");
    const target = requiresTarget
      ? findNearestTarget(this.self, this.getEnemies(), this.weapon.rangeTiles * TILE_SIZE, this.blocker)
      : null;
    if (requiresTarget && !target) return;

    for (const application of definition.effects) {
      const recipient = application.target === "self" ? this.self : target!;
      recipient.statusEffects.apply(application.effectId, application.durationMs);
    }
  }
```

with:

```ts
  private tryBasicAttack(): void {
    if (this.basicAttackCooldownMs > 0) return;
    this.basicAttackCooldownMs = this.weapon.attackSpeedMs;

    const target = findNearestTarget(
      this.self,
      this.getEnemies(),
      this.weapon.rangeTiles * TILE_SIZE,
      this.blocker
    );
    if (!target) return;
    resolveAttackComponents(BASIC_ATTACK.effects, this.self, target, this.weapon.damage);
  }

  private tryAbility(slot: 0 | 1 | 2): void {
    const attackId = this.weapon.attackIds[slot];
    if (!attackId) return;
    if ((this.abilityCooldowns.get(attackId) ?? 0) > 0) return;

    const definition = WEAPON_ATTACKS.find((a) => a.id === attackId);
    if (!definition) return;

    this.abilityCooldowns.set(attackId, definition.cooldownMs);

    const requiresTarget = definition.effects.some((component) => component.target === "target");
    const target = requiresTarget
      ? findNearestTarget(this.self, this.getEnemies(), this.weapon.rangeTiles * TILE_SIZE, this.blocker)
      : null;
    if (requiresTarget && !target) return;

    resolveAttackComponents(definition.effects, this.self, target, this.weapon.damage);
  }
```

- [ ] **Step 3: Add health to `Player.ts`**

Replace the full contents of `frontend/src/game/entities/Player.ts`:

```ts
import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";
import { Weapon } from "../combat/Weapon";
import Health from "../combat/Health";

// Player movement modeled on the "05-physics" example from
// https://github.com/mikewesthad/phaser-3-tilemap-blog-posts (post-1): arcade physics body,
// 4-directional cursor input, velocity normalized so diagonal movement isn't faster.
// No sprite/atlas assets yet, so the player is a plain circle for now.
const PLAYER_SPEED = 350;
const PLAYER_MAX_HP = 100;

export default class Player {
  public sprite: Phaser.GameObjects.Arc;
  public statusEffects: StatusEffectController = new StatusEffectController();
  public health: Health = new Health(PLAYER_MAX_HP);
  public weapon: Weapon;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, x: number, y: number, weapon: Weapon) {
    this.weapon = weapon;
    this.sprite = scene.add.circle(x, y, 8, 0xfacc15);
    scene.physics.add.existing(this.sprite);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    this.cursors = scene.input.keyboard!.createCursorKeys();
  }

  update(deltaMs: number) {
    this.statusEffects.update(deltaMs);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    const speed = PLAYER_SPEED * this.statusEffects.getMagnitude("slow", 1);

    if (this.cursors.left.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right.isDown) body.setVelocityX(speed);

    if (this.cursors.up.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down.isDown) body.setVelocityY(speed);

    // Normalize diagonal movement so it isn't faster than axis-aligned movement.
    body.velocity.normalize().scale(speed);
  }
}
```

- [ ] **Step 4: Add health to `Enemy.ts`**

Replace the full contents of `frontend/src/game/entities/Enemy.ts`:

```ts
import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";
import Health from "../combat/Health";

// Static placeholder enemy - a colored circle with no movement/AI, matching Player's use of a
// plain circle in place of a sprite/atlas. Exists mainly to prove the nameplate and combat
// systems work on a non-player entity; real enemy movement/AI is a separate feature.
export default class Enemy {
  public sprite: Phaser.GameObjects.Arc;
  public statusEffects: StatusEffectController = new StatusEffectController();
  public health: Health;
  public aggressionLevel: number;

  constructor(scene: Phaser.Scene, x: number, y: number, color: string, aggressionLevel: number, maxHp: number) {
    this.sprite = scene.add.circle(x, y, 8, parseInt(color.replace("#", ""), 16));
    this.aggressionLevel = aggressionLevel;
    this.health = new Health(maxHp);
  }

  update(deltaMs: number) {
    this.statusEffects.update(deltaMs);
  }
}
```

- [ ] **Step 5: Wire `health` through `DungeonScene.ts`**

In `frontend/src/game/scenes/DungeonScene.ts`, update the `Enemy` construction (currently `const enemy = new Enemy(this, enemyX, enemyY, config.enemy_color, 3);`):

```ts
      const enemy = new Enemy(this, enemyX, enemyY, config.enemy_color, 3, 50);
```

Update `getPlayerTarget`:

```ts
      const getPlayerTarget = (): CombatEntity => ({
        x: this.player.sprite.x,
        y: this.player.sprite.y,
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      });
```

Update the `AggressiveCombatEntity` built inside `this.enemyCombats = this.enemies.map(...)`:

```ts
      this.enemyCombats = this.enemies.map((e) => {
        const combatEntity: AggressiveCombatEntity = {
          get x() {
            return e.sprite.x;
          },
          get y() {
            return e.sprite.y;
          },
          statusEffects: e.statusEffects,
          health: e.health,
          aggressionLevel: e.aggressionLevel,
        };
        return new EnemyCombat(combatEntity, getPlayerTarget, blocker);
      });
```

Update `playerSelf` and `getEnemyTargets`:

```ts
      const self = this;
      const playerSelf: CombatEntity = {
        get x() {
          return self.player.sprite.x;
        },
        get y() {
          return self.player.sprite.y;
        },
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      };
      const getEnemyTargets = (): CombatEntity[] =>
        this.enemies.map((e) => ({ x: e.sprite.x, y: e.sprite.y, statusEffects: e.statusEffects, health: e.health }));
```

- [ ] **Step 6: Update `EnemyCombat.test.ts` fixtures**

In `frontend/tests/game/combat/EnemyCombat.test.ts`, add the import:

```ts
import Health from "@/game/combat/Health";
```

Update `makeEntity`:

```ts
function makeEntity(aggressionLevel: number): AggressiveCombatEntity {
  return {
    x: 0,
    y: 0,
    statusEffects: new StatusEffectController(),
    health: new Health(100),
    aggressionLevel,
  };
}
```

Update the three manually-constructed `CombatEntity` literals (each currently `{ x: <N>, y: 0, statusEffects: new StatusEffectController() }`, in the "excludes attacks when the target is beyond max range", "excludes attacks when line of sight is blocked", and "includes attacks when the target is within range and line of sight is clear" tests) to each add `health: new Health(100)`, e.g.:

```ts
    const player: CombatEntity = { x: 500, y: 0, statusEffects: new StatusEffectController(), health: new Health(100) }; // 500 > 8 tiles (384px)
```

```ts
    const player: CombatEntity = { x: 100, y: 0, statusEffects: new StatusEffectController(), health: new Health(100) }; // well within range
```

```ts
    const player: CombatEntity = { x: 100, y: 0, statusEffects: new StatusEffectController(), health: new Health(100) };
```

Add one new test at the end of the `describe("EnemyCombat", ...)` block, verifying damage now actually lands:

```ts
  it("deals damage to the target when the chosen attack has a damage component", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, {
      selector: (_enemy, available) => available.find((a) => a.id === "nagging_reminder") ?? null,
    });
    combat.update(1500);
    expect(player.health.getRatio()).toBeLessThan(1);
  });
```

- [ ] **Step 7: Update `PlayerCombat.test.ts` fixtures and add damage tests**

In `frontend/tests/game/combat/PlayerCombat.test.ts`, add the import:

```ts
import Health from "@/game/combat/Health";
```

Update `makeEntity`:

```ts
function makeEntity(x = 0, y = 0): CombatEntity {
  return { x, y, statusEffects: new StatusEffectController(), health: new Health(100) };
}
```

Add a new `describe` block at the end of the file:

```ts

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
```

- [ ] **Step 8: Run the full test suite and typecheck**

Run (from `frontend/`): `npx tsc --noEmit`

Expected: no errors beyond the pre-existing unrelated `journal/page.tsx` one.

Run (from `frontend/`): `npx vitest run`

Expected: PASS - full suite green (previous 72 tests plus this task's new ones).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/game/combat/EnemyCombat.ts frontend/src/game/combat/PlayerCombat.ts frontend/src/game/entities/Player.ts frontend/src/game/entities/Enemy.ts frontend/src/game/scenes/DungeonScene.ts frontend/tests/game/combat/EnemyCombat.test.ts frontend/tests/game/combat/PlayerCombat.test.ts
git commit -m "Wire health through CombatEntity, both combat systems, Player/Enemy, and DungeonScene"
```

---

### Task 6: HP bar on `EntityLabel`

**Files:**
- Modify: `frontend/src/game/ui/EntityLabel.ts`
- Modify: `frontend/src/game/scenes/DungeonScene.ts`

**Interfaces:**
- Consumes: `this.player.health` / `e.health` (Task 5).
- Produces: `EntityLabelOptions.health?: HealthSource` where `HealthSource = { getRatio(): number }`. No later task consumes this beyond the `DungeonScene` wiring in this same task.

No new test file - `EntityLabel.ts`'s rendering has never been unit-tested (only the pure `diffBadgeIds` helper is), consistent with prior EntityLabel work in this codebase. Verified via typecheck, the full suite, and a manual browser check.

- [ ] **Step 1: Add the HP bar to `EntityLabel.ts`**

Replace the full contents of `frontend/src/game/ui/EntityLabel.ts`:

```ts
import type Phaser from "phaser";
import { STATUS_EFFECTS } from "../combat/StatusEffect";

export interface NamePlateTarget {
  x: number;
  y: number;
}

export interface StatusEffectSource {
  getActiveIds(): string[];
  getRemainingRatio(effectId: string): number;
}

export interface HealthSource {
  getRatio(): number;
}

export interface EntityLabelOptions {
  name?: string;
  statusEffects?: StatusEffectSource;
  health?: HealthSource;
  offsetY?: number;
  color?: string;
  fontSize?: string;
}

const DEFAULT_OFFSET_Y = 18;
const DEFAULT_COLOR = "#f8fafc";
const DEFAULT_FONT_SIZE = "12px";
const BADGE_FONT_SIZE = "10px";
const BADGE_STACK_GAP = 14;
const BADGE_LINE_HEIGHT = 19;
const BAR_WIDTH = 40;
const BAR_HEIGHT = 3;
const BAR_GAP = 2;
const HP_BAR_WIDTH = 44;
const HP_BAR_HEIGHT = 6;
const HP_BAR_COLOR = 0x22c55e;
const HP_BAR_BG_COLOR = 0x000000;
const HP_BAR_BG_ALPHA = 0.5;
const NAME_TO_HP_GAP = 8;
const HP_TO_BADGE_GAP = 8;

export function diffBadgeIds(previous: string[], current: string[]): { added: string[]; removed: string[] } {
  const previousSet = new Set(previous);
  const currentSet = new Set(current);
  return {
    added: current.filter((id) => !previousSet.has(id)),
    removed: previous.filter((id) => !currentSet.has(id)),
  };
}

export default class EntityLabel {
  private scene: Phaser.Scene;
  private fontFamily: string;
  private target: NamePlateTarget;
  private offsetY: number;
  private nameText?: Phaser.GameObjects.Text;
  private statusEffects?: StatusEffectSource;
  private health?: HealthSource;
  private healthBarBg?: Phaser.GameObjects.Rectangle;
  private healthBarFill?: Phaser.GameObjects.Rectangle;
  private badgeTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private badgeBars: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private activeBadgeIds: string[] = [];

  constructor(scene: Phaser.Scene, fontFamily: string, target: NamePlateTarget, options: EntityLabelOptions = {}) {
    this.scene = scene;
    this.fontFamily = fontFamily;
    this.target = target;
    this.offsetY = options.offsetY ?? DEFAULT_OFFSET_Y;
    this.statusEffects = options.statusEffects;
    this.health = options.health;

    if (options.name) {
      this.nameText = scene.add
        .text(target.x, target.y - this.offsetY, options.name, {
          fontFamily,
          fontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
          color: options.color ?? DEFAULT_COLOR,
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1);
    }

    if (this.health) {
      const barY = target.y - this.healthBarOffsetY();
      this.healthBarBg = scene.add
        .rectangle(target.x, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_BAR_BG_COLOR, HP_BAR_BG_ALPHA)
        .setOrigin(0.5, 0.5);
      this.healthBarFill = scene.add
        .rectangle(target.x - HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_BAR_COLOR)
        .setOrigin(0, 0.5);
    }
  }

  private healthBarOffsetY(): number {
    return this.offsetY + (this.nameText ? NAME_TO_HP_GAP : 0);
  }

  private badgeRowOffsetY(): number {
    if (this.health) return this.healthBarOffsetY() + HP_TO_BADGE_GAP;
    if (this.nameText) return this.offsetY + BADGE_STACK_GAP;
    return this.offsetY;
  }

  private syncBadges() {
    if (!this.statusEffects) return;
    const currentIds = this.statusEffects.getActiveIds();
    const { added, removed } = diffBadgeIds(this.activeBadgeIds, currentIds);

    for (const id of removed) {
      this.badgeTexts.get(id)?.destroy();
      this.badgeTexts.delete(id);
      this.badgeBars.get(id)?.destroy();
      this.badgeBars.delete(id);
    }

    for (const id of added) {
      const def = STATUS_EFFECTS[id];
      if (!def) continue;
      const text = this.scene.add
        .text(this.target.x, this.target.y, def.label, {
          fontFamily: this.fontFamily,
          fontSize: BADGE_FONT_SIZE,
          color: def.color,
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 1);
      this.badgeTexts.set(id, text);

      const bar = this.scene.add
        .rectangle(this.target.x, this.target.y, BAR_WIDTH, BAR_HEIGHT, parseInt(def.color.replace("#", ""), 16))
        .setOrigin(0, 0.5);
      this.badgeBars.set(id, bar);
    }

    this.activeBadgeIds = currentIds;
  }

  private layoutBadges() {
    const baseY = this.target.y - this.badgeRowOffsetY();

    this.activeBadgeIds.forEach((id, i) => {
      const textY = baseY - i * BADGE_LINE_HEIGHT;
      const text = this.badgeTexts.get(id)!;
      text.setPosition(this.target.x, textY);

      const bar = this.badgeBars.get(id)!;
      const ratio = this.statusEffects?.getRemainingRatio(id) ?? 1;
      bar.setPosition(this.target.x - BAR_WIDTH / 2, textY + BAR_GAP + BAR_HEIGHT / 2);
      bar.width = BAR_WIDTH * ratio;
    });
  }

  update() {
    if (this.nameText) {
      this.nameText.setPosition(this.target.x, this.target.y - this.offsetY);
    }

    if (this.health && this.healthBarBg && this.healthBarFill) {
      const barY = this.target.y - this.healthBarOffsetY();
      this.healthBarBg.setPosition(this.target.x, barY);
      this.healthBarFill.setPosition(this.target.x - HP_BAR_WIDTH / 2, barY);
      this.healthBarFill.width = HP_BAR_WIDTH * Math.max(0, Math.min(1, this.health.getRatio()));
    }

    this.syncBadges();
    this.layoutBadges();
  }

  destroy() {
    this.nameText?.destroy();
    this.healthBarBg?.destroy();
    this.healthBarFill?.destroy();
    this.badgeTexts.forEach((text) => text.destroy());
    this.badgeTexts.clear();
    this.badgeBars.forEach((bar) => bar.destroy());
    this.badgeBars.clear();
  }
}
```

- [ ] **Step 2: Pass `health` into both `EntityLabel` constructions in `DungeonScene.ts`**

Replace:

```ts
      this.entityLabels = [
        new EntityLabel(this, fontFamily, this.player.sprite, { statusEffects: this.player.statusEffects }),
        new EntityLabel(this, fontFamily, enemy.sprite, {
          name: prettifyName(config.enemy_type),
          statusEffects: enemy.statusEffects,
        }),
      ];
```

with:

```ts
      this.entityLabels = [
        new EntityLabel(this, fontFamily, this.player.sprite, {
          statusEffects: this.player.statusEffects,
          health: this.player.health,
        }),
        new EntityLabel(this, fontFamily, enemy.sprite, {
          name: prettifyName(config.enemy_type),
          statusEffects: enemy.statusEffects,
          health: enemy.health,
        }),
      ];
```

- [ ] **Step 3: Typecheck, run the full suite, and manually verify**

Run (from `frontend/`): `npx tsc --noEmit`

Expected: no errors beyond the pre-existing unrelated one.

Run (from `frontend/`): `npx vitest run`

Expected: PASS - full suite green.

Run (from `frontend/`): `npm run dev`, then load `/play` (e.g. via "Preview with mock data") and confirm both the player and the demo enemy show a visibly thicker green HP bar above their name/badges, full-width at the start of the run.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/game/ui/EntityLabel.ts frontend/src/game/scenes/DungeonScene.ts
git commit -m "Add HP bar to EntityLabel"
```

---

### Task 7: Death handling in `DungeonScene`

**Files:**
- Modify: `frontend/src/game/scenes/DungeonScene.ts`

**Interfaces:**
- Consumes: `enemy.health.isDead`, `player.health.isDead` (Task 5).
- Produces: nothing consumed elsewhere in this plan - final integration step.

No new test file, consistent with the rest of `DungeonScene.ts`. Verified via typecheck, the full suite, and a manual browser check (forcing damage via a temporary debug hook, removed before committing).

- [ ] **Step 1: Restructure enemy bookkeeping into `enemyInstances`**

In `frontend/src/game/scenes/DungeonScene.ts`, add this interface directly after the existing `getRoomCount` helper function (before `export function createDungeonScene(...)`):

```ts
interface EnemyInstance {
  enemy: Enemy;
  combat: EnemyCombat;
  label: EntityLabel;
}
```

Replace the class's field declarations:

```ts
    private player!: Player;
    private enemies: Enemy[] = [];
    private entityLabels: EntityLabel[] = [];
    private enemyCombats: EnemyCombat[] = [];
    private playerCombat!: PlayerCombat;
```

with:

```ts
    private player!: Player;
    private playerLabel!: EntityLabel;
    private enemyInstances: EnemyInstance[] = [];
    private playerCombat!: PlayerCombat;
    private isPlayerDead = false;
```

- [ ] **Step 2: Rebuild the enemy/label/combat construction in `create()`**

Replace this whole block (from the enemy construction through the `getEnemyTargets`/`PlayerCombat` construction - everything between `this.physics.add.collider(this.player.sprite, this.stuffLayer);` and the mood-tint section):

```ts
      // Static demo enemy: a second room if the dungeon generated one, otherwise a point offset
      // from the player's spawn within the same room so the two don't overlap.
      const enemyRoom = dungeon.rooms[1] ?? startRoom;
      const enemyTileX = dungeon.rooms[1] ? enemyRoom.centerX : Math.min(enemyRoom.right - 1, enemyRoom.centerX + 2);
      const enemyTileY = dungeon.rooms[1] ? enemyRoom.centerY : Math.min(enemyRoom.bottom - 1, enemyRoom.centerY + 2);
      const enemyX = map.tileToWorldX(enemyTileX)!;
      const enemyY = map.tileToWorldY(enemyTileY)!;
      // Aggression 3 so the demo reaches all three example attacks (see combat/Attack.ts) over time.
      const enemy = new Enemy(this, enemyX, enemyY, config.enemy_color, 3, 50);
      this.enemies = [enemy];

      this.entityLabels = [
        new EntityLabel(this, fontFamily, this.player.sprite, {
          statusEffects: this.player.statusEffects,
          health: this.player.health,
        }),
        new EntityLabel(this, fontFamily, enemy.sprite, {
          name: prettifyName(config.enemy_type),
          statusEffects: enemy.statusEffects,
          health: enemy.health,
        }),
      ];

      const getPlayerTarget = (): CombatEntity => ({
        x: this.player.sprite.x,
        y: this.player.sprite.y,
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      });

      // Reuses the same .collides flag Phaser already computed for player-movement collision
      // (via setCollisionByExclusion above), so line-of-sight blocking always matches what
      // actually blocks movement.
      const blocker: LineOfSightBlocker = {
        isBlocked: (x, y) =>
          !!this.groundLayer.getTileAtWorldXY(x, y)?.collides || !!this.stuffLayer.getTileAtWorldXY(x, y)?.collides,
      };

      this.enemyCombats = this.enemies.map((e) => {
        const combatEntity: AggressiveCombatEntity = {
          get x() {
            return e.sprite.x;
          },
          get y() {
            return e.sprite.y;
          },
          statusEffects: e.statusEffects,
          health: e.health,
          aggressionLevel: e.aggressionLevel,
        };
        return new EnemyCombat(combatEntity, getPlayerTarget, blocker);
      });

      const self = this;
      const playerSelf: CombatEntity = {
        get x() {
          return self.player.sprite.x;
        },
        get y() {
          return self.player.sprite.y;
        },
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      };
      const getEnemyTargets = (): CombatEntity[] =>
        this.enemies.map((e) => ({ x: e.sprite.x, y: e.sprite.y, statusEffects: e.statusEffects, health: e.health }));
      this.playerCombat = new PlayerCombat(
        this.player.weapon,
        playerSelf,
        getEnemyTargets,
        blocker,
        new PhaserAttackInput(this)
      );
```

with:

```ts
      // Static demo enemy: a second room if the dungeon generated one, otherwise a point offset
      // from the player's spawn within the same room so the two don't overlap.
      const enemyRoom = dungeon.rooms[1] ?? startRoom;
      const enemyTileX = dungeon.rooms[1] ? enemyRoom.centerX : Math.min(enemyRoom.right - 1, enemyRoom.centerX + 2);
      const enemyTileY = dungeon.rooms[1] ? enemyRoom.centerY : Math.min(enemyRoom.bottom - 1, enemyRoom.centerY + 2);
      const enemyX = map.tileToWorldX(enemyTileX)!;
      const enemyY = map.tileToWorldY(enemyTileY)!;
      // Aggression 3 so the demo reaches all three example attacks (see combat/Attack.ts) over time.
      const enemy = new Enemy(this, enemyX, enemyY, config.enemy_color, 3, 50);

      this.playerLabel = new EntityLabel(this, fontFamily, this.player.sprite, {
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      });

      const getPlayerTarget = (): CombatEntity => ({
        x: this.player.sprite.x,
        y: this.player.sprite.y,
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      });

      // Reuses the same .collides flag Phaser already computed for player-movement collision
      // (via setCollisionByExclusion above), so line-of-sight blocking always matches what
      // actually blocks movement.
      const blocker: LineOfSightBlocker = {
        isBlocked: (x, y) =>
          !!this.groundLayer.getTileAtWorldXY(x, y)?.collides || !!this.stuffLayer.getTileAtWorldXY(x, y)?.collides,
      };

      const enemyLabel = new EntityLabel(this, fontFamily, enemy.sprite, {
        name: prettifyName(config.enemy_type),
        statusEffects: enemy.statusEffects,
        health: enemy.health,
      });
      const enemyCombatEntity: AggressiveCombatEntity = {
        get x() {
          return enemy.sprite.x;
        },
        get y() {
          return enemy.sprite.y;
        },
        statusEffects: enemy.statusEffects,
        health: enemy.health,
        aggressionLevel: enemy.aggressionLevel,
      };
      const enemyCombat = new EnemyCombat(enemyCombatEntity, getPlayerTarget, blocker);
      this.enemyInstances = [{ enemy, combat: enemyCombat, label: enemyLabel }];

      const self = this;
      const playerSelf: CombatEntity = {
        get x() {
          return self.player.sprite.x;
        },
        get y() {
          return self.player.sprite.y;
        },
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      };
      const getEnemyTargets = (): CombatEntity[] =>
        this.enemyInstances.map(({ enemy }) => ({
          x: enemy.sprite.x,
          y: enemy.sprite.y,
          statusEffects: enemy.statusEffects,
          health: enemy.health,
        }));
      this.playerCombat = new PlayerCombat(
        this.player.weapon,
        playerSelf,
        getEnemyTargets,
        blocker,
        new PhaserAttackInput(this)
      );
```

- [ ] **Step 3: Replace `update()` with death handling**

Replace:

```ts
    update(time: number, delta: number) {
      this.player.update(delta);
      this.enemies.forEach((enemy) => enemy.update(delta));
      this.enemyCombats.forEach((combat) => combat.update(delta));
      this.playerCombat.update(delta);
      this.entityLabels.forEach((label) => label.update());
      if (this.rainSpawnZone) {
        rainFollowCamera(this, this.rainSpawnZone);
      }
    }
```

with:

```ts
    update(time: number, delta: number) {
      if (this.isPlayerDead) return;

      this.player.update(delta);
      this.enemyInstances.forEach(({ enemy }) => enemy.update(delta));
      this.enemyInstances.forEach(({ combat }) => combat.update(delta));
      this.playerCombat.update(delta);

      this.removeDeadEnemies();

      this.playerLabel.update();
      this.enemyInstances.forEach(({ label }) => label.update());

      if (this.rainSpawnZone) {
        rainFollowCamera(this, this.rainSpawnZone);
      }

      if (this.player.health.isDead) {
        this.handlePlayerDeath();
      }
    }

    private removeDeadEnemies() {
      const alive: EnemyInstance[] = [];
      for (const instance of this.enemyInstances) {
        if (instance.enemy.health.isDead) {
          instance.label.destroy();
          instance.enemy.sprite.destroy();
        } else {
          alive.push(instance);
        }
      }
      this.enemyInstances = alive;
    }

    private handlePlayerDeath() {
      this.isPlayerDead = true;
      this.add
        .text(this.scale.width / 2, this.scale.height / 2, "YOU DIED", {
          fontFamily,
          fontSize: "32px",
          color: "#ef4444",
          stroke: "#000000",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0);
    }
```

- [ ] **Step 4: Typecheck and run the full suite**

Run (from `frontend/`): `npx tsc --noEmit`

Expected: no errors beyond the pre-existing unrelated one. (This also removes the previously-unused `time` parameter warning's relevance - `time` is still unused, matching prior behavior; that warning is pre-existing and not part of this change.)

Run (from `frontend/`): `npx vitest run`

Expected: PASS - full suite green.

- [ ] **Step 5: Manually verify enemy death and player death**

Run (from `frontend/`): `npm run dev`, load `/play`.

Enemy death: fight the demo enemy with SPACE/Q/W/E until its HP bar reaches zero and confirm its sprite and nameplate disappear. If landing ~50 damage through normal play is slow, temporarily add a one-line debug call (e.g. expose `enemy.health.takeDamage(999)` via a scratch `window` hook in `create()`, call it from the browser console, then remove the hook) to force it - remove any such temporary code before committing.

Player death: similarly force `this.player.health.takeDamage(999)` via a temporary debug hook and confirm a "YOU DIED" message appears centered on screen and the player stops responding to movement/attack input. Remove the temporary hook afterward.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/game/scenes/DungeonScene.ts
git commit -m "Add death handling: enemies are removed, player death shows YOU DIED"
```
