# Attacks + Status Effects System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a data-driven attack + status-effect system where enemies (gated by an `aggressionLevel`) apply status effects to the player and/or themselves, displayed as colored text badges above each entity's head via the existing nameplate system.

**Architecture:** Pure-logic modules (`StatusEffect`, `Attack`, `StatusEffectController`, `EnemyCombat`) live under `src/game/combat/` with zero Phaser runtime dependency, so they're unit-testable with Vitest in a plain Node environment. `NamePlate` is renamed to `EntityLabel` and gains an optional status-badge row rather than introducing a parallel display class. `Player`/`Enemy` each own a `StatusEffectController` via composition. `DungeonScene` is the only place that wires the Phaser-dependent glue (positions, timers, scene lifecycle) together.

**Tech Stack:** TypeScript, Phaser 4, Vitest (new dev dependency for this plan).

## Global Constraints

- Reapplying an already-active effect refreshes its duration; it does not stack magnitude.
- `StatusEffectController` has no `hasTag` method - nothing in this system consumes it (the immunity check inside `apply()` compares `blocksTags` against `tags` directly).
- `suppressed` is tracked and displayed but not enforced - there is no ability system yet to gate. Do not add one as part of this plan.
- No damage/health system, no real enemy AI (movement, targeting, range checks), no player abilities. `EnemyCombat`'s `trigger`/`selector` are injectable specifically so a future AI system can replace the defaults without touching this plan's code.
- Only one demo enemy is spawned in `DungeonScene`, even though `enemies: Enemy[]` supports more.
- `EntityLabel` replaces `NamePlate` entirely (rename in place) - not a new parallel class.
- Vitest is a new devDependency, used only for the Phaser-independent logic in `src/game/combat/` and `diffBadgeIds` in `src/game/ui/EntityLabel.ts`. Phaser-rendering code (Text creation/positioning, Player/Enemy Phaser wiring) has no automated test - it's verified manually via a browser-driven check in the final task, matching how the nameplates feature was verified.
- All new/modified game code lives under `frontend/src/game/`; `frontend/` is the Next.js project root for all commands in this plan.

---

### Task 1: Add Vitest + the `StatusEffect` data model

**Files:**
- Modify: `frontend/package.json` (add `test` script)
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/game/combat/StatusEffect.ts`
- Test: `frontend/src/game/combat/StatusEffect.test.ts`

**Interfaces:**
- Produces: `EffectTag = "cc" | "buff" | "debuff"`, `StatusEffectDefinition { id, label, color, tags, blocksTags?, magnitude? }`, `STATUS_EFFECTS: Record<string, StatusEffectDefinition>` with keys `slow`, `suppressed`, `unstoppable`.

- [ ] **Step 1: Install Vitest**

Run (from `frontend/`): `npm install -D vitest`
Expected: exits 0; `vitest` appears under `devDependencies` in `frontend/package.json`.

- [ ] **Step 2: Add the Vitest config**

Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Add the `test` script**

Modify `frontend/package.json` - the `scripts` block currently reads:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
```

Change it to:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Write the failing test**

Create `frontend/src/game/combat/StatusEffect.test.ts`:

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
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run (from `frontend/`): `npx vitest run src/game/combat/StatusEffect.test.ts`
Expected: FAIL - `Cannot find module './StatusEffect'` (the file doesn't exist yet).

- [ ] **Step 6: Implement `StatusEffect.ts`**

Create `frontend/src/game/combat/StatusEffect.ts`:

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
};
```

- [ ] **Step 7: Run the test to verify it passes**

Run (from `frontend/`): `npx vitest run src/game/combat/StatusEffect.test.ts`
Expected: PASS - 4 tests passed.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/game/combat/StatusEffect.ts frontend/src/game/combat/StatusEffect.test.ts
git commit -m "Add Vitest and the status effect data model"
```

---

### Task 2: `StatusEffectController`

**Files:**
- Create: `frontend/src/game/combat/StatusEffectController.ts`
- Test: `frontend/src/game/combat/StatusEffectController.test.ts`

**Interfaces:**
- Consumes: `STATUS_EFFECTS`, `StatusEffectDefinition` from `./StatusEffect` (Task 1).
- Produces: `export default class StatusEffectController` with `apply(effectId: string, durationMs: number): boolean`, `has(effectId: string): boolean`, `getMagnitude(effectId: string, fallback?: number): number`, `getActiveIds(): string[]`, `update(deltaMs: number): void`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/game/combat/StatusEffectController.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import StatusEffectController from "./StatusEffectController";

describe("StatusEffectController", () => {
  let controller: StatusEffectController;

  beforeEach(() => {
    controller = new StatusEffectController();
  });

  it("applies an effect and reports it as active", () => {
    expect(controller.apply("slow", 1000)).toBe(true);
    expect(controller.has("slow")).toBe(true);
    expect(controller.getActiveIds()).toEqual(["slow"]);
  });

  it("returns the effect's magnitude while active, and the fallback when not", () => {
    expect(controller.getMagnitude("slow", 1)).toBe(1);
    controller.apply("slow", 1000);
    expect(controller.getMagnitude("slow", 1)).toBe(0.5);
  });

  it("expires an effect once its duration has elapsed", () => {
    controller.apply("slow", 1000);
    controller.update(600);
    expect(controller.has("slow")).toBe(true);
    controller.update(500);
    expect(controller.has("slow")).toBe(false);
  });

  it("refreshes duration on reapplication instead of stacking", () => {
    controller.apply("slow", 1000);
    controller.update(900);
    controller.apply("slow", 1000);
    controller.update(900);
    expect(controller.has("slow")).toBe(true);
  });

  it("blocks a cc-tagged effect while unstoppable is active", () => {
    controller.apply("unstoppable", 1000);
    expect(controller.apply("slow", 1000)).toBe(false);
    expect(controller.has("slow")).toBe(false);
  });

  it("does not block a buff while unstoppable is active", () => {
    controller.apply("unstoppable", 1000);
    expect(controller.apply("unstoppable", 500)).toBe(true);
  });

  it("ignores unknown effect ids", () => {
    expect(controller.apply("not_a_real_effect", 1000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/game/combat/StatusEffectController.test.ts`
Expected: FAIL - `Cannot find module './StatusEffectController'`.

- [ ] **Step 3: Implement `StatusEffectController.ts`**

Create `frontend/src/game/combat/StatusEffectController.ts`:

```ts
import { STATUS_EFFECTS, StatusEffectDefinition } from "./StatusEffect";

interface ActiveEffect {
  def: StatusEffectDefinition;
  remainingMs: number;
}

export default class StatusEffectController {
  private active: Map<string, ActiveEffect> = new Map();

  apply(effectId: string, durationMs: number): boolean {
    const def = STATUS_EFFECTS[effectId];
    if (!def) return false;

    for (const activeEffect of this.active.values()) {
      if (activeEffect.def.blocksTags?.some((tag) => def.tags.includes(tag))) {
        return false;
      }
    }

    this.active.set(effectId, { def, remainingMs: durationMs });
    return true;
  }

  has(effectId: string): boolean {
    return this.active.has(effectId);
  }

  getMagnitude(effectId: string, fallback = 1): number {
    const effect = this.active.get(effectId);
    return effect?.def.magnitude ?? fallback;
  }

  getActiveIds(): string[] {
    return Array.from(this.active.keys());
  }

  update(deltaMs: number): void {
    for (const [id, effect] of this.active) {
      effect.remainingMs -= deltaMs;
      if (effect.remainingMs <= 0) {
        this.active.delete(id);
      }
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/game/combat/StatusEffectController.test.ts`
Expected: PASS - 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/StatusEffectController.ts frontend/src/game/combat/StatusEffectController.test.ts
git commit -m "Add StatusEffectController"
```

---

### Task 3: `Attack` data model

**Files:**
- Create: `frontend/src/game/combat/Attack.ts`
- Test: `frontend/src/game/combat/Attack.test.ts`

**Interfaces:**
- Consumes: `STATUS_EFFECTS` from `./StatusEffect` (Task 1), for the catalog cross-check test only.
- Produces: `AttackEffectApplication { effectId, target: "self" | "target", durationMs }`, `AttackDefinition { id, name, minAggression, cooldownMs, effects }`, `ATTACKS: AttackDefinition[]` with ids `brace`, `nagging_reminder`, `silencing_glare`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/game/combat/Attack.test.ts`:

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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/game/combat/Attack.test.ts`
Expected: FAIL - `Cannot find module './Attack'`.

- [ ] **Step 3: Implement `Attack.ts`**

Create `frontend/src/game/combat/Attack.ts`:

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
}

export const ATTACKS: AttackDefinition[] = [
  {
    id: "brace",
    name: "Brace",
    minAggression: 1,
    cooldownMs: 5000,
    effects: [{ effectId: "unstoppable", target: "self", durationMs: 3000 }],
  },
  {
    id: "nagging_reminder",
    name: "Nagging Reminder",
    minAggression: 2,
    cooldownMs: 4000,
    effects: [{ effectId: "slow", target: "target", durationMs: 2000 }],
  },
  {
    id: "silencing_glare",
    name: "Silencing Glare",
    minAggression: 3,
    cooldownMs: 6000,
    effects: [{ effectId: "suppressed", target: "target", durationMs: 2500 }],
  },
];
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/game/combat/Attack.test.ts`
Expected: PASS - 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/Attack.ts frontend/src/game/combat/Attack.test.ts
git commit -m "Add Attack data model"
```

---

### Task 4: `EnemyCombat`

**Files:**
- Create: `frontend/src/game/combat/EnemyCombat.ts`
- Test: `frontend/src/game/combat/EnemyCombat.test.ts`

**Interfaces:**
- Consumes: `StatusEffectController` (Task 2, default-constructed with no args), `ATTACKS`, `AttackDefinition` from `./Attack` (Task 3).
- Produces: `CombatEntity { x, y, statusEffects: StatusEffectController }`, `AggressiveCombatEntity extends CombatEntity { aggressionLevel: number }`, `AttackSelector`, `AttackTrigger`, `getAvailableAttacks(aggressionLevel: number, cooldowns: Map<string, number>): AttackDefinition[]`, `export default class EnemyCombat` with `constructor(enemy: AggressiveCombatEntity, getTarget: () => CombatEntity, options?: { trigger?: AttackTrigger; selector?: AttackSelector })` and `update(deltaMs: number): void`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/game/combat/EnemyCombat.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/game/combat/EnemyCombat.test.ts`
Expected: FAIL - `Cannot find module './EnemyCombat'`.

- [ ] **Step 3: Implement `EnemyCombat.ts`**

Create `frontend/src/game/combat/EnemyCombat.ts`:

```ts
import { ATTACKS, AttackDefinition } from "./Attack";
import StatusEffectController from "./StatusEffectController";

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

    const available = getAvailableAttacks(this.enemy.aggressionLevel, this.cooldowns);
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
Expected: PASS - 9 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/EnemyCombat.ts frontend/src/game/combat/EnemyCombat.test.ts
git commit -m "Add EnemyCombat auto-attack driver"
```

---

### Task 5: Rename `NamePlate` to `EntityLabel`, add status-badge display

**Files:**
- Create: `frontend/src/game/ui/EntityLabel.ts`
- Delete: `frontend/src/game/ui/NamePlate.ts`
- Test: `frontend/src/game/ui/EntityLabel.test.ts`

**Interfaces:**
- Consumes: `STATUS_EFFECTS` from `../combat/StatusEffect` (Task 1), for badge label/color lookup.
- Produces: `NamePlateTarget { x, y }`, `StatusEffectSource { getActiveIds(): string[] }`, `EntityLabelOptions { name?, statusEffects?, offsetY?, color?, fontSize? }`, `diffBadgeIds(previous: string[], current: string[]): { added: string[]; removed: string[] }`, `export default class EntityLabel` with `constructor(scene: Phaser.Scene, fontFamily: string, target: NamePlateTarget, options?: EntityLabelOptions)`, `update(): void`, `destroy(): void`.

The class body uses `scene.add.text(...)` (real Phaser calls), so only the pure `diffBadgeIds` helper is unit tested here - the rendering itself is verified manually in Task 7. `EntityLabel.ts` only imports `Phaser` as a type (`import type Phaser from "phaser"`), so this test file has no runtime Phaser/canvas dependency and runs fine under Vitest's `node` environment.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/game/ui/EntityLabel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { diffBadgeIds } from "./EntityLabel";

describe("diffBadgeIds", () => {
  it("reports newly active ids as added", () => {
    expect(diffBadgeIds([], ["slow"])).toEqual({ added: ["slow"], removed: [] });
  });

  it("reports ids no longer active as removed", () => {
    expect(diffBadgeIds(["slow"], [])).toEqual({ added: [], removed: ["slow"] });
  });

  it("reports ids present in both as neither added nor removed", () => {
    expect(diffBadgeIds(["slow"], ["slow"])).toEqual({ added: [], removed: [] });
  });

  it("handles simultaneous additions and removals", () => {
    expect(diffBadgeIds(["slow"], ["suppressed"])).toEqual({ added: ["suppressed"], removed: ["slow"] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `frontend/`): `npx vitest run src/game/ui/EntityLabel.test.ts`
Expected: FAIL - `Cannot find module './EntityLabel'`.

- [ ] **Step 3: Implement `EntityLabel.ts`**

Create `frontend/src/game/ui/EntityLabel.ts` (this replaces `NamePlate.ts` - same responsibility, plus the badge row):

```ts
import type Phaser from "phaser";
import { STATUS_EFFECTS } from "../combat/StatusEffect";

export interface NamePlateTarget {
  x: number;
  y: number;
}

export interface StatusEffectSource {
  getActiveIds(): string[];
}

export interface EntityLabelOptions {
  name?: string;
  statusEffects?: StatusEffectSource;
  offsetY?: number;
  color?: string;
  fontSize?: string;
}

const DEFAULT_OFFSET_Y = 18;
const DEFAULT_COLOR = "#f8fafc";
const DEFAULT_FONT_SIZE = "12px";
const BADGE_FONT_SIZE = "10px";
const BADGE_STACK_GAP = 14;
const BADGE_SPACING = 6;

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
  private badgeTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private activeBadgeIds: string[] = [];

  constructor(scene: Phaser.Scene, fontFamily: string, target: NamePlateTarget, options: EntityLabelOptions = {}) {
    this.scene = scene;
    this.fontFamily = fontFamily;
    this.target = target;
    this.offsetY = options.offsetY ?? DEFAULT_OFFSET_Y;
    this.statusEffects = options.statusEffects;

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
  }

  private badgeRowOffsetY(): number {
    return this.nameText ? this.offsetY + BADGE_STACK_GAP : this.offsetY;
  }

  private syncBadges() {
    if (!this.statusEffects) return;
    const currentIds = this.statusEffects.getActiveIds();
    const { added, removed } = diffBadgeIds(this.activeBadgeIds, currentIds);

    for (const id of removed) {
      this.badgeTexts.get(id)?.destroy();
      this.badgeTexts.delete(id);
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
    }

    this.activeBadgeIds = currentIds;
  }

  private layoutBadges() {
    const rowY = this.target.y - this.badgeRowOffsetY();
    const widths = this.activeBadgeIds.map((id) => this.badgeTexts.get(id)!.width);
    const totalWidth = widths.reduce((sum, w) => sum + w, 0) + BADGE_SPACING * Math.max(0, widths.length - 1);
    let cursorX = this.target.x - totalWidth / 2;

    this.activeBadgeIds.forEach((id, i) => {
      const text = this.badgeTexts.get(id)!;
      text.setPosition(cursorX + widths[i] / 2, rowY);
      cursorX += widths[i] + BADGE_SPACING;
    });
  }

  update() {
    if (this.nameText) {
      this.nameText.setPosition(this.target.x, this.target.y - this.offsetY);
    }
    this.syncBadges();
    this.layoutBadges();
  }

  destroy() {
    this.nameText?.destroy();
    this.badgeTexts.forEach((text) => text.destroy());
    this.badgeTexts.clear();
  }
}
```

- [ ] **Step 4: Delete the old file**

Delete `frontend/src/game/ui/NamePlate.ts`.

- [ ] **Step 5: Run the test to verify it passes**

Run (from `frontend/`): `npx vitest run src/game/ui/EntityLabel.test.ts`
Expected: PASS - 4 tests passed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/game/ui/EntityLabel.ts frontend/src/game/ui/EntityLabel.test.ts
git rm frontend/src/game/ui/NamePlate.ts
git commit -m "Rename NamePlate to EntityLabel, add status-badge row"
```

---

### Task 6: Wire it into `Player`, `Enemy`, and `DungeonScene`

**Files:**
- Modify: `frontend/src/game/entities/Player.ts` (currently 35 lines - full file shown below)
- Modify: `frontend/src/game/entities/Enemy.ts` (currently 12 lines - full file shown below)
- Modify: `frontend/src/game/scenes/DungeonScene.ts:1-12` (imports), `:41-50` (class fields), `:130-145` (player/enemy creation), `:186-193` (`update`)

**Interfaces:**
- Consumes: `StatusEffectController` (Task 2), `EntityLabel`, `EntityLabelOptions` (Task 5), `EnemyCombat`, `CombatEntity`, `AggressiveCombatEntity` (Task 4).
- Produces: `Player.statusEffects: StatusEffectController`, `Player.update(deltaMs: number)`; `Enemy.statusEffects: StatusEffectController`, `Enemy.aggressionLevel: number`, `Enemy.update(deltaMs: number)`; `createDungeonScene`'s exported signature is unchanged (`(PhaserLib, config, fontFamily)`).

No new automated tests in this task - it's Phaser-dependent glue code, verified by `tsc`/`next build` here and by the browser-driven check in Task 7.

- [ ] **Step 1: Update `Player.ts`**

Replace the full contents of `frontend/src/game/entities/Player.ts` with:

```ts
import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";

// Player movement modeled on the "05-physics" example from
// https://github.com/mikewesthad/phaser-3-tilemap-blog-posts (post-1): arcade physics body,
// 4-directional cursor input, velocity normalized so diagonal movement isn't faster.
// No sprite/atlas assets yet, so the player is a plain circle for now.
const PLAYER_SPEED = 350;

export default class Player {
  public sprite: Phaser.GameObjects.Arc;
  public statusEffects: StatusEffectController = new StatusEffectController();
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, x: number, y: number) {
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

- [ ] **Step 2: Update `Enemy.ts`**

Replace the full contents of `frontend/src/game/entities/Enemy.ts` with:

```ts
import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";

// Static placeholder enemy - a colored circle with no movement/AI, matching Player's use of a
// plain circle in place of a sprite/atlas. Exists mainly to prove the nameplate and combat
// systems work on a non-player entity; real enemy movement/AI is a separate feature.
export default class Enemy {
  public sprite: Phaser.GameObjects.Arc;
  public statusEffects: StatusEffectController = new StatusEffectController();
  public aggressionLevel: number;

  constructor(scene: Phaser.Scene, x: number, y: number, color: string, aggressionLevel: number) {
    this.sprite = scene.add.circle(x, y, 8, parseInt(color.replace("#", ""), 16));
    this.aggressionLevel = aggressionLevel;
  }

  update(deltaMs: number) {
    this.statusEffects.update(deltaMs);
  }
}
```

- [ ] **Step 3: Update `DungeonScene.ts` imports**

In `frontend/src/game/scenes/DungeonScene.ts`, replace this line (currently line 12):

```ts
import NamePlate from "../ui/NamePlate";
```

with:

```ts
import EntityLabel from "../ui/EntityLabel";
import EnemyCombat, { CombatEntity, AggressiveCombatEntity } from "../combat/EnemyCombat";
```

- [ ] **Step 4: Update the class fields**

Replace (currently lines 43-45):

```ts
    private player!: Player;
    private enemy!: Enemy;
    private nameplates: NamePlate[] = [];
```

with:

```ts
    private player!: Player;
    private enemies: Enemy[] = [];
    private entityLabels: EntityLabel[] = [];
    private enemyCombats: EnemyCombat[] = [];
```

- [ ] **Step 5: Update enemy/label creation in `create()`**

Replace (currently lines 136-145):

```ts
      // Static demo enemy: a second room if the dungeon generated one, otherwise a point offset
      // from the player's spawn within the same room so the two don't overlap.
      const enemyRoom = dungeon.rooms[1] ?? startRoom;
      const enemyTileX = dungeon.rooms[1] ? enemyRoom.centerX : Math.min(enemyRoom.right - 1, enemyRoom.centerX + 2);
      const enemyTileY = dungeon.rooms[1] ? enemyRoom.centerY : Math.min(enemyRoom.bottom - 1, enemyRoom.centerY + 2);
      const enemyX = map.tileToWorldX(enemyTileX)!;
      const enemyY = map.tileToWorldY(enemyTileY)!;
      this.enemy = new Enemy(this, enemyX, enemyY, config.enemy_color);

      this.nameplates = [new NamePlate(this, fontFamily, this.enemy.sprite, prettifyName(config.enemy_type))];
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
      const enemy = new Enemy(this, enemyX, enemyY, config.enemy_color, 3);
      this.enemies = [enemy];

      this.entityLabels = [
        new EntityLabel(this, fontFamily, this.player.sprite, { statusEffects: this.player.statusEffects }),
        new EntityLabel(this, fontFamily, enemy.sprite, {
          name: prettifyName(config.enemy_type),
          statusEffects: enemy.statusEffects,
        }),
      ];

      const getPlayerTarget = (): CombatEntity => ({
        x: this.player.sprite.x,
        y: this.player.sprite.y,
        statusEffects: this.player.statusEffects,
      });

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

- [ ] **Step 6: Update `update()`**

Replace (currently lines 186-193):

```ts
    update() {
      this.player.update();
      this.nameplates.forEach((nameplate) => nameplate.update());
      if (this.rainSpawnZone) {
        rainFollowCamera(this, this.rainSpawnZone);
      }
    }
```

with:

```ts
    update(time: number, delta: number) {
      this.player.update(delta);
      this.enemies.forEach((enemy) => enemy.update(delta));
      this.enemyCombats.forEach((combat) => combat.update(delta));
      this.entityLabels.forEach((label) => label.update());
      if (this.rainSpawnZone) {
        rainFollowCamera(this, this.rainSpawnZone);
      }
    }
```

- [ ] **Step 7: Run the full test suite**

Run (from `frontend/`): `npx vitest run`
Expected: PASS - all suites from Tasks 1-5 still pass (nothing in this task touched tested modules, so this just confirms nothing broke).

- [ ] **Step 8: Type-check**

Run (from `frontend/`): `npx tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 9: Build**

Run (from `frontend/`): `npx next build`
Expected: `✓ Compiled successfully`, no errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/game/entities/Player.ts frontend/src/game/entities/Enemy.ts frontend/src/game/scenes/DungeonScene.ts
git commit -m "Wire status effects and enemy attacks into DungeonScene"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated test suite**

Run (from `frontend/`): `npx vitest run`
Expected: PASS - all tests from Tasks 1-5 (StatusEffect: 4, StatusEffectController: 7, Attack: 3, EnemyCombat: 9, EntityLabel: 4 = 27 tests) pass.

- [ ] **Step 2: Type-check and build**

Run (from `frontend/`): `npx tsc --noEmit -p . && npx next build`
Expected: both exit 0, no errors.

- [ ] **Step 3: Start the dev server**

Run (from `frontend/`): `npm run dev &` (background), then poll until it's serving:

```bash
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
```

Expected: `server up` (the loop exits once the port responds).

- [ ] **Step 4: Install Playwright and write the verification script**

Run (from `frontend/`): `npm install -D playwright && npx playwright install chromium`
Expected: exits 0; `playwright` appears under `devDependencies`.

Create `frontend/verify-status-effects.js`. It navigates to `/play` via "Preview with mock data", then holds `ArrowRight` continuously for the whole capture window (so player displacement between screenshots is directly comparable), screenshotting every 3s for 21s - long enough to observe at least one attack, since the demo enemy's fastest attack (`nagging_reminder`, `slow`) can fire as early as ~1.5s in and the slowest (`silencing_glare`) has a 6s cooldown:

```js
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.click("text=Preview with mock data");
  await page.waitForURL("**/play");
  await page.waitForSelector("canvas", { timeout: 15000 });

  const canvas = await page.$("canvas");
  await canvas.click();
  await page.keyboard.down("ArrowRight");

  for (let i = 0; i < 7; i++) {
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `status-effects-check-${i}.png` });
  }

  await page.keyboard.up("ArrowRight");
  console.log("CONSOLE_ERRORS:", JSON.stringify(consoleErrors));
  await browser.close();
})();
```

- [ ] **Step 5: Run the script and inspect the screenshots**

Run (from `frontend/`): `node verify-status-effects.js`
Expected: `CONSOLE_ERRORS` contains nothing beyond the pre-existing WebSocket-refused warning (no backend running - expected and unrelated).

Read `status-effects-check-0.png` through `status-effects-check-6.png` in order. Confirm:
1. At least one screenshot shows a colored badge (`SLOW`, `SUPPRESSED`, or `UNSTOPPABLE`) above the enemy's head, and at least one shows a badge above the player's head (no name, badges only).
2. Comparing consecutive screenshots: the player's horizontal displacement between frames where its badge row shows `SLOW` is visibly smaller than its displacement between frames with no badge - confirming `Player.update` reading `getMagnitude("slow", 1)` actually reduces movement, not just that the badge renders.

- [ ] **Step 6: Stop the dev server**

Run (PowerShell, matches how the nameplates feature's dev server was stopped): find and stop the process listening on port 3000.
Expected: `curl -sf http://localhost:3000` fails afterward.

- [ ] **Step 7: Report results**

No commit for this task - it's verification only. Report: test counts passed, build status, and what the screenshots showed (which badges appeared, whether the player visibly slowed).
