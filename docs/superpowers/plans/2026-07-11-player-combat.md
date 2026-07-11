# Player Combat (Basic Attack + Abilities) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player fight back: SPACE swings the weapon's basic attack, and Q/W/E fire up to three weapon abilities drawn from `weapon.attackIds`. Effects-only (status effects, no damage/health), matching how `EnemyCombat` already works.

**Architecture:** A new `PlayerCombat` class (`src/game/combat/PlayerCombat.ts`) mirrors `EnemyCombat`'s shape but is input-driven instead of timer-driven. Input is behind an `AttackInput` interface so `PlayerCombat`'s targeting/cooldown/effect logic is unit-testable without a real Phaser scene; a `PhaserAttackInput` class (same file) implements it for real gameplay by polling SPACE/Q/W/E key state. `DungeonScene` constructs one `PlayerCombat` per run and ticks it every frame, reusing the `blocker` it already builds for `EnemyCombat`.

**Tech Stack:** TypeScript, Phaser 3, Vitest (frontend workspace at `frontend/`, all commands below run with `frontend/` as the working directory).

## Global Constraints

- Effects-only: apply status effects via `StatusEffectController.apply`, no damage/health/death. (Spec: "Scope")
- The basic attack (SPACE) is not one of `weapon.attackIds` - it's a fixed action every weapon has, applying `slow` for 500ms to the nearest qualifying enemy. (Spec: "Scope")
- Abilities (Q/W/E) map positionally to `weapon.attackIds[0]`, `[1]`, `[2]`; a missing slot is a no-op. Each ability has its own `cooldownMs`, independent of the basic attack and other abilities. (Spec: "Scope")
- An ability "requires a target" if any of its effect applications has `target: "target"`; if every effect targets `"self"`, it fires unconditionally with no range/LoS gate. (Spec: "Scope")
- A whiff (basic attack or target-requiring ability with no qualifying enemy) still starts that action's cooldown. (Spec: "Scope")
- Targeting picks the nearest enemy within `weapon.rangeTiles * TILE_SIZE` with line-of-sight (`hasLineOfSight` from `lineOfSight.ts`). (Spec: "Data model")
- `PlayerCombat` must not import the Phaser runtime or depend on a real `Phaser.Scene` - only `AttackInput`, which `PhaserAttackInput` implements separately. (Spec: "Data model")

---

### Task 1: Add `cooldownMs` to the weapon ability catalog

**Files:**
- Modify: `frontend/src/game/combat/WeaponAttack.ts`
- Test: `frontend/src/game/combat/WeaponAttack.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `WeaponAttackDefinition.cooldownMs: number`, populated on every entry in `WEAPON_ATTACKS`. Task 2's `PlayerCombat` reads this field.

- [ ] **Step 1: Write the failing test**

Add this test to the end of the `describe("WEAPON_ATTACKS catalog", ...)` block in `frontend/src/game/combat/WeaponAttack.test.ts` (after the existing `it("includes at least one attack with no effects...)` block, before the closing `});` on line 22):

```ts
  it("gives every attack a positive cooldown", () => {
    for (const attack of WEAPON_ATTACKS) {
      expect(attack.cooldownMs).toBeGreaterThan(0);
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `frontend/`): `npx vitest run src/game/combat/WeaponAttack.test.ts`

Expected: FAIL - `attack.cooldownMs` is `undefined`, so `toBeGreaterThan(0)` fails.

- [ ] **Step 3: Add `cooldownMs` to the interface and every catalog entry**

Replace the full contents of `frontend/src/game/combat/WeaponAttack.ts`:

```ts
import { AttackEffectApplication } from "./Attack";

export interface WeaponAttackDefinition {
  id: string;
  name: string;
  cooldownMs: number;
  effects: AttackEffectApplication[];
}

export const WEAPON_ATTACKS: WeaponAttackDefinition[] = [
  { id: "quick_slash", name: "Quick Slash", cooldownMs: 2000, effects: [] },
  {
    id: "puncture",
    name: "Puncture",
    cooldownMs: 3000,
    effects: [{ effectId: "slow", target: "target", durationMs: 2000 }],
  },
  {
    id: "intimidating_strike",
    name: "Intimidating Strike",
    cooldownMs: 4000,
    effects: [{ effectId: "suppressed", target: "target", durationMs: 2500 }],
  },
  {
    id: "battle_focus",
    name: "Battle Focus",
    cooldownMs: 5000,
    effects: [{ effectId: "unstoppable", target: "self", durationMs: 3000 }],
  },
  {
    id: "power_swing",
    name: "Power Swing",
    cooldownMs: 4000,
    effects: [{ effectId: "bonus_damage", target: "self", durationMs: 2000 }],
  },
  {
    id: "heavy_strike",
    name: "Heavy Strike",
    cooldownMs: 3000,
    effects: [{ effectId: "charge_time", target: "self", durationMs: 1200 }],
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `frontend/`): `npx vitest run src/game/combat/WeaponAttack.test.ts`

Expected: PASS - all tests in the file green, including the new cooldown assertion.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/WeaponAttack.ts frontend/src/game/combat/WeaponAttack.test.ts
git commit -m "Add cooldownMs to the weapon ability catalog"
```

---

### Task 2: Build `PlayerCombat` (core targeting/cooldown/effect logic)

**Files:**
- Create: `frontend/src/game/combat/PlayerCombat.ts`
- Test: `frontend/src/game/combat/PlayerCombat.test.ts`

**Interfaces:**
- Consumes: `CombatEntity` from `frontend/src/game/combat/EnemyCombat.ts` (existing, unchanged: `{ x: number; y: number; statusEffects: StatusEffectController }`); `LineOfSightBlocker`, `hasLineOfSight` from `frontend/src/game/combat/lineOfSight.ts` (existing); `Weapon` from `frontend/src/game/combat/Weapon.ts` (existing); `WEAPON_ATTACKS` from `frontend/src/game/combat/WeaponAttack.ts` (Task 1's `cooldownMs` field); `TILE_SIZE` from `frontend/src/game/constants.ts` (existing, value `48`).
- Produces: `export interface AttackInput { isBasicAttackJustPressed(): boolean; isAbilityJustPressed(slot: 0 | 1 | 2): boolean; }` and `export default class PlayerCombat` with constructor `(weapon: Weapon, self: CombatEntity, getEnemies: () => CombatEntity[], blocker: LineOfSightBlocker, input: AttackInput)` and method `update(deltaMs: number): void`. Task 3 adds `PhaserAttackInput` (implements `AttackInput`) to this same file. Task 4 imports `PlayerCombat` and `PhaserAttackInput` from this file into `DungeonScene.ts`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/game/combat/PlayerCombat.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import PlayerCombat, { AttackInput } from "./PlayerCombat";
import { CombatEntity } from "./EnemyCombat";
import StatusEffectController from "./StatusEffectController";
import { LineOfSightBlocker } from "./lineOfSight";
import { Weapon } from "./Weapon";

const OPEN_BLOCKER: LineOfSightBlocker = { isBlocked: () => false };
const BLOCKED_BLOCKER: LineOfSightBlocker = { isBlocked: () => true };

function makeEntity(x = 0, y = 0): CombatEntity {
  return { x, y, statusEffects: new StatusEffectController() };
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
    const enemy = makeEntity(10, 0);
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

    combat.update(0); // whiff, starts cooldown
    combat.update(500); // cooldown fully elapsed
    enemies[0] = makeEntity(10, 0); // move into range for the next press

    combat.update(0);

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/game/combat/PlayerCombat.test.ts`

Expected: FAIL - `Cannot find module './PlayerCombat'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `PlayerCombat`**

Create `frontend/src/game/combat/PlayerCombat.ts`:

```ts
import { CombatEntity } from "./EnemyCombat";
import { LineOfSightBlocker, hasLineOfSight } from "./lineOfSight";
import { Weapon } from "./Weapon";
import { WEAPON_ATTACKS } from "./WeaponAttack";
import { TILE_SIZE } from "../constants";

const BASIC_ATTACK_EFFECT_ID = "slow";
const BASIC_ATTACK_EFFECT_DURATION_MS = 500;

export interface AttackInput {
  isBasicAttackJustPressed(): boolean;
  isAbilityJustPressed(slot: 0 | 1 | 2): boolean;
}

function findNearestTarget(
  self: CombatEntity,
  enemies: CombatEntity[],
  maxRangeWorldUnits: number,
  blocker: LineOfSightBlocker
): CombatEntity | null {
  let nearest: CombatEntity | null = null;
  let nearestDistance = Infinity;

  for (const enemy of enemies) {
    const distance = Math.hypot(enemy.x - self.x, enemy.y - self.y);
    if (distance > maxRangeWorldUnits) continue;
    if (!hasLineOfSight(blocker, self.x, self.y, enemy.x, enemy.y)) continue;
    if (distance < nearestDistance) {
      nearest = enemy;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export default class PlayerCombat {
  private basicAttackCooldownMs = 0;
  private abilityCooldowns: Map<string, number> = new Map();

  constructor(
    private weapon: Weapon,
    private self: CombatEntity,
    private getEnemies: () => CombatEntity[],
    private blocker: LineOfSightBlocker,
    private input: AttackInput
  ) {}

  update(deltaMs: number): void {
    this.basicAttackCooldownMs = Math.max(0, this.basicAttackCooldownMs - deltaMs);
    for (const [id, remaining] of this.abilityCooldowns) {
      const next = remaining - deltaMs;
      if (next <= 0) this.abilityCooldowns.delete(id);
      else this.abilityCooldowns.set(id, next);
    }

    if (this.input.isBasicAttackJustPressed()) this.tryBasicAttack();
    for (const slot of [0, 1, 2] as const) {
      if (this.input.isAbilityJustPressed(slot)) this.tryAbility(slot);
    }
  }

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
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/game/combat/PlayerCombat.test.ts`

Expected: PASS - all tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/PlayerCombat.ts frontend/src/game/combat/PlayerCombat.test.ts
git commit -m "Add PlayerCombat for basic attack and ability targeting/cooldowns"
```

---

### Task 3: Add the Phaser keyboard input adapter

**Files:**
- Modify: `frontend/src/game/combat/PlayerCombat.ts`

**Interfaces:**
- Consumes: `AttackInput` (defined in Task 2, same file).
- Produces: `export class PhaserAttackInput implements AttackInput`, constructor `(scene: Phaser.Scene)`. Task 4 constructs this in `DungeonScene.ts` and passes it into `PlayerCombat`.

No test for this class - it wraps live Phaser keyboard state the same way `Player.ts`'s cursor-key handling and `Enemy.ts` have no dedicated test files (thin Phaser-adapter code, verified by typecheck + the manual browser check in Task 4).

- [ ] **Step 1: Add the import and the adapter class**

In `frontend/src/game/combat/PlayerCombat.ts`, add this import at the top of the file (after the existing imports):

```ts
import type Phaser from "phaser";
```

Then append this to the end of the file, after the `PlayerCombat` class:

```ts
type AttackKeyName = "space" | "q" | "w" | "e";

export class PhaserAttackInput implements AttackInput {
  private keys: Record<AttackKeyName, Phaser.Input.Keyboard.Key>;
  private wasDown: Record<AttackKeyName, boolean> = { space: false, q: false, w: false, e: false };

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard!;
    this.keys = {
      space: keyboard.addKey("SPACE"),
      q: keyboard.addKey("Q"),
      w: keyboard.addKey("W"),
      e: keyboard.addKey("E"),
    };
  }

  isBasicAttackJustPressed(): boolean {
    return this.justPressed("space");
  }

  isAbilityJustPressed(slot: 0 | 1 | 2): boolean {
    const name: AttackKeyName = slot === 0 ? "q" : slot === 1 ? "w" : "e";
    return this.justPressed(name);
  }

  private justPressed(name: AttackKeyName): boolean {
    const isDown = this.keys[name].isDown;
    const justPressed = isDown && !this.wasDown[name];
    this.wasDown[name] = isDown;
    return justPressed;
  }
}
```

- [ ] **Step 2: Typecheck and run the full test suite**

Run (from `frontend/`): `npx tsc --noEmit`

Expected: no new errors introduced by this file (the pre-existing unrelated `journal/page.tsx` error, if present on this branch, is not something this task touches).

Run (from `frontend/`): `npx vitest run`

Expected: PASS - full existing suite green, no regressions.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/combat/PlayerCombat.ts
git commit -m "Add PhaserAttackInput keyboard adapter for PlayerCombat"
```

---

### Task 4: Wire `PlayerCombat` into `DungeonScene`

**Files:**
- Modify: `frontend/src/game/scenes/DungeonScene.ts`

**Interfaces:**
- Consumes: `PlayerCombat`, `PhaserAttackInput` from `frontend/src/game/combat/PlayerCombat.ts` (Tasks 2-3); existing `CombatEntity` from `EnemyCombat.ts`; existing `this.player.weapon`, `this.player.statusEffects`, `this.enemies`, `blocker`.
- Produces: nothing consumed elsewhere in this plan - this is the final integration point.

No new test file - `DungeonScene.ts` follows the same no-dedicated-test precedent as the rest of the scene-wiring code (confirmed in the prior weapon-assignment plan). Verified via typecheck, the full suite, and a manual browser check.

- [ ] **Step 1: Import `PlayerCombat` and `PhaserAttackInput`**

In `frontend/src/game/scenes/DungeonScene.ts`, add this import directly below the existing `EnemyCombat` import (currently line 14, `import EnemyCombat, { CombatEntity, AggressiveCombatEntity } from "../combat/EnemyCombat";`):

```ts
import PlayerCombat, { PhaserAttackInput } from "../combat/PlayerCombat";
```

- [ ] **Step 2: Add a `playerCombat` field**

Add a new private field alongside the existing `enemyCombats` field (currently line 36, `private enemyCombats: EnemyCombat[] = [];`):

```ts
    private playerCombat!: PlayerCombat;
```

- [ ] **Step 3: Construct `PlayerCombat` after `enemyCombats` is built**

In `create()`, directly after the `this.enemyCombats = this.enemies.map(...)` block (currently ending at line 174 with the closing `});`), add:

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
      };
      const getEnemyTargets = (): CombatEntity[] =>
        this.enemies.map((e) => ({ x: e.sprite.x, y: e.sprite.y, statusEffects: e.statusEffects }));
      this.playerCombat = new PlayerCombat(
        this.player.weapon,
        playerSelf,
        getEnemyTargets,
        blocker,
        new PhaserAttackInput(this)
      );
```

`playerSelf`'s getters read `self.player.sprite.x`/`y` rather than `this.player...` because inside an object-literal getter, `this` refers to the object literal itself (`playerSelf`), not the enclosing `DungeonScene` instance - so `const self = this;` captures the scene reference from `create()`'s own `this` one line above, and the getters close over `self` instead. This way `playerSelf.x`/`y` always reflect the player's current position on every read, matching how `AggressiveCombatEntity` does it for enemies via the closed-over `e` variable in the `.map()` callback just above.

- [ ] **Step 4: Tick `playerCombat` every frame**

In `update(time, delta)` (currently lines 215-223), add a call alongside the existing `enemyCombats` tick:

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

- [ ] **Step 5: Typecheck and run the full test suite**

Run (from `frontend/`): `npx tsc --noEmit`

Expected: no new errors from this change.

Run (from `frontend/`): `npx vitest run`

Expected: PASS - full suite green.

- [ ] **Step 6: Manually verify in the browser**

Run (from `frontend/`): `npm run dev`

Open the app, reach `/play` (e.g. via "Preview with mock data"), and confirm:
- Standing near the demo enemy and pressing SPACE makes the "SLOW" badge (from `EntityLabel`) appear above the enemy.
- Pressing Q applies "SLOW" (puncture) to the enemy when in range - the demo weapon's `attackIds` are randomly generated per run, so if Q/W/E don't visibly do anything, check the browser console isn't erroring and try the other keys; at least one of Q/W/E should be present since every generated weapon has 1-3 `attackIds`.
- Moving far from the enemy or behind a wall and pressing SPACE/Q/W/E does not apply any badge.
- No new console errors beyond the pre-existing unrelated backend-websocket 403 (already observed and confirmed unrelated in the prior weapon-assignment work).

Stop the dev server afterward.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/game/scenes/DungeonScene.ts
git commit -m "Wire PlayerCombat into DungeonScene"
```
