# Attacks + Status Effects System — Design

## Goal

A data-driven system for enemy attacks that apply status effects (to the player and/or to
themselves), tiered by an enemy's "aggression level," with the effects visually displayed above
each entity's head. Must scale to multiple enemies and be easy to evolve into real enemy AI later.

## Scope

- Status effect definitions (data), with tag-based categorization (`cc`, `buff`, `debuff`) and
  tag-based immunity (e.g. "unstoppable" blocks anything tagged `cc`).
- Attack definitions (data), gated by an enemy's `aggressionLevel` via `minAggression`.
- A generic `StatusEffectController` component, owned by any entity (`Player`, `Enemy`).
- A timer-based `EnemyCombat` driver that automatically fires attacks at the player - no real
  AI (no range/line-of-sight/targeting logic) - but built with swappable trigger/selector
  functions so real AI can replace the defaults later without touching cooldown or effect-
  application logic.
- Merge status-badge display into the existing nameplate system (renamed `NamePlate` →
  `EntityLabel`), rather than a separate UI class duplicating position-tracking.
- Concrete effects: `slow` (reduces player move speed), `suppressed` (flagged/displayed, not
  enforced yet - no ability system exists to gate), `unstoppable` (self-buff, blocks incoming
  `cc`-tagged effects).

Out of scope: real enemy AI (movement, targeting, range checks), an ability system for the
player (needed to actually enforce `suppressed`), damage/health, multiple simultaneous demo
enemies (the architecture supports N enemies, but only one demo enemy is spawned).

## Data model

### `src/game/combat/StatusEffect.ts`

```ts
export type EffectTag = "cc" | "buff" | "debuff";

export interface StatusEffectDefinition {
  id: string;
  label: string;             // badge text, e.g. "SLOW"
  color: string;              // badge text color
  tags: EffectTag[];
  blocksTags?: EffectTag[];   // e.g. unstoppable blocks "cc"
  magnitude?: number;         // e.g. slow's speed multiplier (0.5)
}

export const STATUS_EFFECTS: Record<string, StatusEffectDefinition> = {
  slow: { id: "slow", label: "SLOW", color: "#38bdf8", tags: ["cc", "debuff"], magnitude: 0.5 },
  suppressed: { id: "suppressed", label: "SUPPRESSED", color: "#a855f7", tags: ["cc", "debuff"] },
  unstoppable: { id: "unstoppable", label: "UNSTOPPABLE", color: "#facc15", tags: ["buff"], blocksTags: ["cc"] },
};
```

### `src/game/combat/Attack.ts`

```ts
export interface AttackEffectApplication {
  effectId: string;
  target: "self" | "target";
  durationMs: number;
}

export interface AttackDefinition {
  id: string;
  name: string;
  minAggression: number;   // usable if enemy.aggressionLevel >= this
  cooldownMs: number;
  effects: AttackEffectApplication[];
}

export const ATTACKS: AttackDefinition[] = [
  { id: "brace", name: "Brace", minAggression: 1, cooldownMs: 5000,
    effects: [{ effectId: "unstoppable", target: "self", durationMs: 3000 }] },
  { id: "nagging_reminder", name: "Nagging Reminder", minAggression: 2, cooldownMs: 4000,
    effects: [{ effectId: "slow", target: "target", durationMs: 2000 }] },
  { id: "silencing_glare", name: "Silencing Glare", minAggression: 3, cooldownMs: 6000,
    effects: [{ effectId: "suppressed", target: "target", durationMs: 2500 }] },
];
```

An enemy can use any attack where `aggressionLevel >= minAggression` - higher aggression
strictly widens the available pool.

## `StatusEffectController` (`src/game/combat/StatusEffectController.ts`)

Generic component, owned by any entity via composition (`player.statusEffects`,
`enemy.statusEffects`) - the same way `Player` already owns `sprite`.

```ts
export default class StatusEffectController {
  apply(effectId: string, durationMs: number): boolean; // false if blocked by an active immunity
  has(effectId: string): boolean;
  getMagnitude(effectId: string, fallback?: number): number;
  getActiveIds(): string[];       // read by EntityLabel for the badge row
  update(deltaMs: number): void;  // ticks durations, expires effects
}
```

- **Apply-time immunity check:** before adding a new effect, checks whether any currently-active
  effect's `blocksTags` includes any of the incoming effect's `tags`. If so, `apply()` is a
  no-op and returns `false`. This is how `unstoppable` (`blocksTags: ["cc"]`) generically
  rejects `slow`/`suppressed` (both tagged `cc`) - no hardcoded pairwise immunity checks, and any
  future `cc`-tagged effect is automatically covered.
- **Reapplication refreshes duration** rather than stacking magnitude.
- No `hasTag` method - considered during design but nothing in this system actually consumes a
  tag-presence query (the immunity check compares `blocksTags` against `tags` directly inside
  `apply()`, not via a public `hasTag` call). Add it later if a real consumer needs it.

### Ownership and data flow

- `Player` and `Enemy` each hold `public statusEffects: StatusEffectController`, created in
  their own constructor.
- **Self-read:** the owning entity reads its own controller in its own `update()`. E.g.
  `Player.update()`:
  ```ts
  const speedMultiplier = this.statusEffects.getMagnitude("slow", 1);
  body.velocity.normalize().scale(PLAYER_SPEED * speedMultiplier);
  ```
- **External write:** nothing pushes effects into an entity unprompted. `EnemyCombat` (below)
  already holds direct references to both the enemy and (via a target-getter) the player, and
  calls `.apply(...)` directly on whichever entity's controller a given attack's effect targets.
  No event bus - direct method calls between objects that already know about each other, matching
  how the rest of the scene is wired (e.g. `DungeonScene` calling `nameplate.update()` directly
  today).
- **Read for display:** `EntityLabel` is handed the controller (structurally, via a minimal
  `StatusEffectSource` interface - see below) and calls `getActiveIds()` every frame.

## `EnemyCombat` (`src/game/combat/EnemyCombat.ts`)

One instance per enemy; owns that enemy's own cooldown state (a local `Map<attackId, remainingMs>`),
so enemies never share cooldowns with each other.

```ts
interface CombatEntity {
  x: number;
  y: number;
  statusEffects: StatusEffectController;
}

type AttackSelector = (enemy: Enemy, available: AttackDefinition[]) => AttackDefinition | null;
type AttackTrigger = (enemy: Enemy, target: CombatEntity, timeSinceLastAttempt: number) => boolean;

export default class EnemyCombat {
  constructor(
    enemy: Enemy,
    getTarget: () => CombatEntity,
    options?: { selector?: AttackSelector; trigger?: AttackTrigger }
  );
  update(deltaMs: number): void;
}
```

Default behavior (deliberately simple - no real AI):
- **`trigger`** defaults to "~1.5s has passed since the last attempt" - no range/line-of-sight
  check.
- **`selector`** defaults to "pick a random attack whose `minAggression <= enemy.aggressionLevel`
  and whose per-enemy cooldown has elapsed."
- On a successful pick: sets that attack's cooldown, then for each entry in `attack.effects`,
  resolves `"self"` → the enemy, `"target"` → `getTarget()`, and calls
  `.statusEffects.apply(effectId, durationMs)` on the resolved recipient.

**Why this scales into a better AI later without rework:** `trigger` and `selector` are
injectable functions - swap the trigger for a real range check, or the selector for smarter
target-state-aware logic, without touching cooldown bookkeeping or effect application. The class
only depends on `enemy.x/y` and `aggressionLevel`, with zero assumptions about how the enemy got
to that position, so movement/pathing is independent future work. Each `EnemyCombat` is
self-contained per enemy instance, so scaling to N enemies is just constructing N of them.

## Display: merge into the nameplate system

Renaming `src/game/ui/NamePlate.ts` → `src/game/ui/EntityLabel.ts` (same file/module,
`NamePlate` → `EntityLabel`) rather than adding a parallel `StatusEffectDisplay` class. Both a
nameplate and a status-badge row need identical per-frame behavior - track a target's x/y and
keep text positioned above it - so a separate class would duplicate that tracking and force
`DungeonScene` to manually coordinate offsets so badges stack above the nameplate.

```ts
export interface StatusEffectSource {
  getActiveIds(): string[]; // minimal read interface - EntityLabel doesn't import combat/ types
}

export interface EntityLabelOptions {
  name?: string;                     // omit to show only status badges (the player's case)
  statusEffects?: StatusEffectSource;
  offsetY?: number;
}

export default class EntityLabel {
  constructor(scene: Phaser.Scene, fontFamily: string, target: NamePlateTarget, options: EntityLabelOptions);
  update(): void;
  destroy(): void;
}
```

- If `name` is given, renders like today's nameplate; the badge row stacks above it automatically
  (badge row Y = name text's top minus a fixed gap).
- If `name` is omitted (the player - its nameplate is currently toggled off), the badge row
  anchors directly at the default label offset above the target, i.e. the same visual slot the
  nameplate would occupy.
- Badges are diffed against `statusEffects.getActiveIds()` each frame (a `Map<effectId, Text>`),
  adding/removing `Text` objects as effects activate/expire, each colored/labeled from
  `STATUS_EFFECTS`.
- `StatusEffectSource` is a minimal structural interface (mirrors the existing `NamePlateTarget`
  pattern) so `ui/EntityLabel.ts` has no dependency on `combat/` - `StatusEffectController`
  satisfies it structurally by having a matching method.

## Scaling to multiple enemies

- `DungeonScene` moves from a single `enemy`/`nameplates` pair to `enemies: Enemy[]`.
- For each spawned enemy: one `EntityLabel` (name + its `statusEffects`) and one `EnemyCombat`.
- All `EnemyCombat`s target the same player via a shared `() => player.sprite` -style getter
  returning `player` (which satisfies `CombatEntity`) - cheap, no registry needed since
  `DungeonScene` already holds direct references to everything.
- `scene.update(time, delta)` (currently declared as a zero-arg `update()` and needs to start
  accepting Phaser's `time`/`delta` params) loops: `player.update(delta)`, then per enemy
  `enemy.update(delta)` + `enemyCombat.update(delta)`, then all `EntityLabel.update()` calls.

### `deltaMs`

Milliseconds elapsed since the previous frame, passed into `Scene.update(time, delta)` by
Phaser automatically. Durations must count down in real time, not per-frame, or they'd run
shorter/longer depending on framerate - so `StatusEffectController.update(deltaMs)` does
`remaining -= deltaMs` per active effect, and `EnemyCombat.update(deltaMs)` does the same for
cooldowns and its attack-attempt timer.

## Demo wiring

- `Enemy` gains `aggressionLevel: number` (constructor param, set to `3` for the demo enemy so
  all three example attacks are reachable over time) and `statusEffects: StatusEffectController`,
  plus an `update(deltaMs)` that ticks the controller.
- `Player` gains `statusEffects: StatusEffectController`; `update` reads
  `getMagnitude("slow", 1)` to scale movement speed.
- `DungeonScene` still spawns just one demo `Enemy` - the array-based structure supports more,
  but a second demo enemy isn't needed to prove the system works.
- One `EntityLabel` for the enemy (name + badges), one for the player (badges only, no name).

## Verification

- `npx tsc --noEmit` and `npx next build`.
- Drive the app with the headless-Chromium/Playwright script (same approach as the nameplates
  feature - no test framework in this repo): navigate through "Preview with mock data" to
  `/play`, then wait/screenshot across ~10-15s (effects are timer-driven) to catch the
  slow/suppressed/unstoppable badges actually appearing and expiring, and confirm the player
  visibly moves slower while "SLOW" is active.
