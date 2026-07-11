# Line of Sight for Attacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attacks can optionally require an unobstructed line to their target and/or a maximum range, checked independently. Apply both to all three current attacks.

**Architecture:** Two pure functions (`isWithinRange`, `hasLineOfSight`) in a new `combat/lineOfSight.ts`, decoupled from Phaser via a minimal `LineOfSightBlocker` interface (`{ isBlocked(x, y): boolean }`). `EnemyCombat` applies them as an additional filter step after its existing aggression/cooldown filter, using a required constructor-injected blocker. `DungeonScene` supplies the real blocker, querying the tilemap's existing collision flags.

**Tech Stack:** TypeScript, Vitest (already set up in this repo).

## Global Constraints

- `requiresLineOfSight` and `maxRangeTiles` are independent optional fields on `AttackDefinition` - not bundled into one object. An attack can have either, both, or neither.
- All three current attacks (`brace`, `nagging_reminder`, `silencing_glare`) get both: `requiresLineOfSight: true, maxRangeTiles: 8`.
- `getAvailableAttacks` (aggression + cooldown filtering) is unchanged - range/LOS is a separate filter step inside `EnemyCombat.update()`, not folded into that function.
- `EnemyCombat`'s `blocker: LineOfSightBlocker` constructor parameter is required, not defaulted - a missing LOS wiring should be a compile error, not a silent "walls don't matter" fallback.
- `hasLineOfSight` samples the line at `TILE_SIZE / 4` (12px) spacing.
- Pure logic in `combat/` is unit-tested with Vitest. `DungeonScene.ts`'s Phaser-dependent wiring has no automated test - verified via `tsc`/`next build` plus a manual browser check.

---

### Task 1: `lineOfSight.ts`

**Files:**
- Create: `frontend/src/game/combat/lineOfSight.ts`
- Test: `frontend/src/game/combat/lineOfSight.test.ts`

**Interfaces:**
- Produces: `LineOfSightBlocker { isBlocked(x: number, y: number): boolean }`, `isWithinRange(fromX, fromY, toX, toY, maxRangeWorldUnits): boolean`, `hasLineOfSight(blocker, fromX, fromY, toX, toY): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/game/combat/lineOfSight.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isWithinRange, hasLineOfSight, LineOfSightBlocker } from "./lineOfSight";

describe("isWithinRange", () => {
  it("is true when the distance is less than the max range", () => {
    expect(isWithinRange(0, 0, 10, 0, 20)).toBe(true);
  });

  it("is true when the distance exactly equals the max range", () => {
    expect(isWithinRange(0, 0, 20, 0, 20)).toBe(true);
  });

  it("is false when the distance exceeds the max range", () => {
    expect(isWithinRange(0, 0, 21, 0, 20)).toBe(false);
  });
});

describe("hasLineOfSight", () => {
  const open: LineOfSightBlocker = { isBlocked: () => false };

  it("is true when nothing blocks the line", () => {
    expect(hasLineOfSight(open, 0, 0, 100, 0)).toBe(true);
  });

  it("is false when a sampled point along the line is blocked", () => {
    const wallAtMidpoint: LineOfSightBlocker = {
      isBlocked: (x) => Math.abs(x - 50) < 6,
    };
    expect(hasLineOfSight(wallAtMidpoint, 0, 0, 100, 0)).toBe(false);
  });

  it("is true when the blocker only blocks points off the line", () => {
    const blocksElsewhere: LineOfSightBlocker = {
      isBlocked: (x, y) => y > 10, // the test line stays at y = 0
    };
    expect(hasLineOfSight(blocksElsewhere, 0, 0, 100, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/game/combat/lineOfSight.test.ts`
Expected: FAIL - `Cannot find module './lineOfSight'`.

- [ ] **Step 3: Implement `lineOfSight.ts`**

Create `frontend/src/game/combat/lineOfSight.ts`:

```ts
import { TILE_SIZE } from "../constants";

export interface LineOfSightBlocker {
  isBlocked(x: number, y: number): boolean;
}

export function isWithinRange(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  maxRangeWorldUnits: number
): boolean {
  return Math.hypot(toX - fromX, toY - fromY) <= maxRangeWorldUnits;
}

export function hasLineOfSight(
  blocker: LineOfSightBlocker,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const steps = Math.ceil(Math.hypot(dx, dy) / (TILE_SIZE / 4));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocker.isBlocked(fromX + dx * t, fromY + dy * t)) return false;
  }

  return true;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/game/combat/lineOfSight.test.ts`
Expected: PASS - 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/lineOfSight.ts frontend/src/game/combat/lineOfSight.test.ts
git commit -m "Add line-of-sight and range check functions"
```

---

### Task 2: `Attack.ts` — add `requiresLineOfSight`/`maxRangeTiles`

**Files:**
- Modify: `frontend/src/game/combat/Attack.ts` (full file, 37 lines)
- Modify: `frontend/src/game/combat/Attack.test.ts` (full file, 24 lines)

**Interfaces:**
- Produces: `AttackDefinition` gains optional `requiresLineOfSight?: boolean` and `maxRangeTiles?: number`.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `frontend/src/game/combat/Attack.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { ATTACKS } from "./Attack";
import { STATUS_EFFECTS } from "./StatusEffect";

describe("ATTACKS catalog", () => {
  it("only references effect ids that exist in STATUS_EFFECTS", () => {
    for (const attack of ATTACKS) {
      for (const application of attack.effects) {
        expect(STATUS_EFFECTS[application.effectId]).toBeDefined();
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `frontend/`): `npx vitest run src/game/combat/Attack.test.ts`
Expected: FAIL - the new test fails (`expect(undefined).toBe(true)`), the other 3 still pass.

- [ ] **Step 3: Implement**

Replace the full contents of `frontend/src/game/combat/Attack.ts` with:

```ts
export interface AttackEffectApplication {
  effectId: string;
  target: "self" | "target";
  durationMs: number;
}

export interface AttackDefinition {
  id: string;
  name: string;
  minAggression: number;
  cooldownMs: number;
  effects: AttackEffectApplication[];
  requiresLineOfSight?: boolean;
  maxRangeTiles?: number;
}

export const ATTACKS: AttackDefinition[] = [
  {
    id: "brace",
    name: "Brace",
    minAggression: 1,
    cooldownMs: 5000,
    effects: [{ effectId: "unstoppable", target: "self", durationMs: 3000 }],
    requiresLineOfSight: true,
    maxRangeTiles: 8,
  },
  {
    id: "nagging_reminder",
    name: "Nagging Reminder",
    minAggression: 2,
    cooldownMs: 4000,
    effects: [{ effectId: "slow", target: "target", durationMs: 2000 }],
    requiresLineOfSight: true,
    maxRangeTiles: 8,
  },
  {
    id: "silencing_glare",
    name: "Silencing Glare",
    minAggression: 3,
    cooldownMs: 6000,
    effects: [{ effectId: "suppressed", target: "target", durationMs: 2500 }],
    requiresLineOfSight: true,
    maxRangeTiles: 8,
  },
];
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/game/combat/Attack.test.ts`
Expected: PASS - 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/Attack.ts frontend/src/game/combat/Attack.test.ts
git commit -m "Add line-of-sight and range requirements to all current attacks"
```

---

### Task 3: `EnemyCombat.ts` — apply range/LOS filtering

**Files:**
- Modify: `frontend/src/game/combat/EnemyCombat.ts` (full file, 82 lines)
- Modify: `frontend/src/game/combat/EnemyCombat.test.ts` (full file, 104 lines)

**Interfaces:**
- Consumes: `LineOfSightBlocker`, `isWithinRange`, `hasLineOfSight` from `./lineOfSight` (Task 1); `TILE_SIZE` from `../constants`; `AttackDefinition.requiresLineOfSight`/`maxRangeTiles` (Task 2).
- Produces: `EnemyCombat`'s constructor gains a required third parameter `blocker: LineOfSightBlocker` (the previous third parameter, `options`, becomes the fourth). `getAvailableAttacks`'s signature is unchanged.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `frontend/src/game/combat/EnemyCombat.test.ts` with:

```ts
import { describe, it, expect, vi } from "vitest";
import EnemyCombat, { getAvailableAttacks, AggressiveCombatEntity, CombatEntity } from "./EnemyCombat";
import StatusEffectController from "./StatusEffectController";
import { ATTACKS, AttackDefinition } from "./Attack";
import { LineOfSightBlocker } from "./lineOfSight";

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
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run (from `frontend/`): `npx vitest run src/game/combat/EnemyCombat.test.ts`
Expected: FAIL - a TypeScript error (wrong number of constructor arguments) since `EnemyCombat`'s constructor doesn't accept a `blocker` parameter yet.

- [ ] **Step 3: Implement**

Replace the full contents of `frontend/src/game/combat/EnemyCombat.ts` with:

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

export interface AggressiveCombatEntity extends CombatEntity {
  aggressionLevel: number;
}

export type AttackSelector = (
  enemy: AggressiveCombatEntity,
  available: AttackDefinition[]
) => AttackDefinition | null;

export type AttackTrigger = (
  enemy: AggressiveCombatEntity,
  target: CombatEntity,
  timeSinceLastAttempt: number
) => boolean;

const DEFAULT_ATTACK_ATTEMPT_INTERVAL_MS = 1500;

export function getAvailableAttacks(
  aggressionLevel: number,
  cooldowns: Map<string, number>
): AttackDefinition[] {
  return ATTACKS.filter(
    (attack) => attack.minAggression <= aggressionLevel && (cooldowns.get(attack.id) ?? 0) <= 0
  );
}

const defaultTrigger: AttackTrigger = (_enemy, _target, timeSinceLastAttempt) =>
  timeSinceLastAttempt >= DEFAULT_ATTACK_ATTEMPT_INTERVAL_MS;

const defaultSelector: AttackSelector = (_enemy, available) =>
  available.length === 0 ? null : available[Math.floor(Math.random() * available.length)];

export default class EnemyCombat {
  private cooldowns: Map<string, number> = new Map();
  private timeSinceLastAttempt = 0;
  private trigger: AttackTrigger;
  private selector: AttackSelector;

  constructor(
    private enemy: AggressiveCombatEntity,
    private getTarget: () => CombatEntity,
    private blocker: LineOfSightBlocker,
    options?: { trigger?: AttackTrigger; selector?: AttackSelector }
  ) {
    this.trigger = options?.trigger ?? defaultTrigger;
    this.selector = options?.selector ?? defaultSelector;
  }

  update(deltaMs: number): void {
    for (const [id, remaining] of this.cooldowns) {
      const next = remaining - deltaMs;
      if (next <= 0) this.cooldowns.delete(id);
      else this.cooldowns.set(id, next);
    }

    this.timeSinceLastAttempt += deltaMs;

    const target = this.getTarget();
    if (!this.trigger(this.enemy, target, this.timeSinceLastAttempt)) return;
    this.timeSinceLastAttempt = 0;

    const byAggressionAndCooldown = getAvailableAttacks(this.enemy.aggressionLevel, this.cooldowns);
    const available = byAggressionAndCooldown.filter((attack) => {
      if (
        attack.maxRangeTiles !== undefined &&
        !isWithinRange(this.enemy.x, this.enemy.y, target.x, target.y, attack.maxRangeTiles * TILE_SIZE)
      ) {
        return false;
      }
      if (
        attack.requiresLineOfSight &&
        !hasLineOfSight(this.blocker, this.enemy.x, this.enemy.y, target.x, target.y)
      ) {
        return false;
      }
      return true;
    });

    const chosen = this.selector(this.enemy, available);
    if (!chosen) return;

    this.cooldowns.set(chosen.id, chosen.cooldownMs);

    for (const application of chosen.effects) {
      const recipient = application.target === "self" ? this.enemy : target;
      recipient.statusEffects.apply(application.effectId, application.durationMs);
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/game/combat/EnemyCombat.test.ts`
Expected: PASS - 13 tests passed (3 `getAvailableAttacks` + 10 `EnemyCombat`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/EnemyCombat.ts frontend/src/game/combat/EnemyCombat.test.ts
git commit -m "Apply range and line-of-sight filtering to enemy attack selection"
```

---

### Task 4: Wire the real blocker into `DungeonScene.ts`

**Files:**
- Modify: `frontend/src/game/scenes/DungeonScene.ts:13` (import), `:156-168` (enemy combat construction)

**Interfaces:**
- Consumes: `LineOfSightBlocker` from `../combat/lineOfSight` (Task 1).

No new automated tests - this is Phaser-dependent glue code, verified by `tsc`/`next build` here and by the browser check in Task 5.

- [ ] **Step 1: Update the import**

In `frontend/src/game/scenes/DungeonScene.ts`, replace this line (currently line 13):

```ts
import EnemyCombat, { CombatEntity, AggressiveCombatEntity } from "../combat/EnemyCombat";
```

with:

```ts
import EnemyCombat, { CombatEntity, AggressiveCombatEntity } from "../combat/EnemyCombat";
import { LineOfSightBlocker } from "../combat/lineOfSight";
```

- [ ] **Step 2: Construct the blocker and pass it to `EnemyCombat`**

Replace (currently lines 156-168):

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
          aggressionLevel: e.aggressionLevel,
        };
        return new EnemyCombat(combatEntity, getPlayerTarget);
      });
```

with:

```ts
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
          aggressionLevel: e.aggressionLevel,
        };
        return new EnemyCombat(combatEntity, getPlayerTarget, blocker);
      });
```

- [ ] **Step 3: Run the full test suite**

Run (from `frontend/`): `npx vitest run`
Expected: PASS - all suites from Tasks 1-3 still pass (this task doesn't touch tested modules).

- [ ] **Step 4: Type-check**

Run (from `frontend/`): `npx tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 5: Build**

Run (from `frontend/`): `npx next build`
Expected: `✓ Compiled successfully`, no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/game/scenes/DungeonScene.ts
git commit -m "Wire tilemap-based line-of-sight blocker into enemy combat"
```

---

### Task 5: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated test suite**

Run (from `frontend/`): `npx vitest run`
Expected: PASS - all tests from Tasks 1-3 (lineOfSight: 6, Attack: 4, EnemyCombat: 3 + 10 = 13, plus the pre-existing StatusEffect: 4, StatusEffectController: 7, EntityLabel: 4 = 38 total) pass.

- [ ] **Step 2: Type-check and build**

Run (from `frontend/`): `npx tsc --noEmit -p . && npx next build`
Expected: both exit 0, no errors.

- [ ] **Step 3: Start the dev server**

Run (from `frontend/`): `npm run dev &` (background), then poll until it's serving:

```bash
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
```

- [ ] **Step 4: Drive the app and compare in-room vs. behind-a-wall**

Using Playwright (`playwright` is already a devDependency from the previous feature's verification work): navigate to the app, click through to `/play` via "Practice run (mock data)" (confirm the exact button text in `frontend/src/components/book/TodaySpread.tsx` first, since UI copy has changed before), wait for the canvas, then:

1. Keep the player in the enemy's own room for ~15s (hold movement toward the enemy's room, then release once there), screenshotting every 3s. Expect at least one status badge (SLOW/SUPPRESSED/UNSTOPPABLE) to appear on the player or enemy during this window.
2. Navigate the player into a different room, separated from the enemy's room by at least one wall, and hold there for ~15s, screenshotting every 3s. Expect no new status badges to appear on the player during this window (the enemy may still self-buff `unstoppable` on itself if it ever regains line of sight to a target within range - but with the player out of range/LOS entirely, no attack should be selectable at all, so no badges anywhere).

- [ ] **Step 5: Inspect the screenshots**

Read the screenshots from both phases. Confirm: badges appear during the in-room phase, and no new badges appear during the behind-a-wall/out-of-range phase. Check the console for unexpected errors (the WebSocket-refused warning from the missing backend is expected).

- [ ] **Step 6: Stop the dev server**

Find and stop whatever process is listening on port 3000.
Expected: `curl -sf http://localhost:3000` fails afterward.

- [ ] **Step 7: Report results**

No commit for this task - it's verification only. Report: test counts passed, build status, and what the two screenshot phases showed.
