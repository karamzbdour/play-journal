# Line of Sight for Attacks — Design

## Goal

Attacks can optionally require an unobstructed line to their target and/or a maximum range. Apply both to all three current attacks (`brace`, `nagging_reminder`, `silencing_glare`).

## Data model (`Attack.ts`)

```ts
export interface AttackDefinition {
  id: string;
  name: string;
  minAggression: number;
  cooldownMs: number;
  effects: AttackEffectApplication[];
  requiresLineOfSight?: boolean;
  maxRangeTiles?: number;
}
```

Decoupled: an attack can have either, both, or neither. All three current attacks get `requiresLineOfSight: true, maxRangeTiles: 8`.

## `src/game/combat/lineOfSight.ts` (new)

Two independent pure functions, no Phaser dependency:

```ts
export interface LineOfSightBlocker {
  isBlocked(x: number, y: number): boolean;
}

export function isWithinRange(fromX: number, fromY: number, toX: number, toY: number, maxRangeWorldUnits: number): boolean {
  return Math.hypot(toX - fromX, toY - fromY) <= maxRangeWorldUnits;
}

export function hasLineOfSight(blocker: LineOfSightBlocker, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const dx = toX - fromX, dy = toY - fromY;
  const steps = Math.ceil(Math.hypot(dx, dy) / (TILE_SIZE / 4)); // sample every 12px
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocker.isBlocked(fromX + dx * t, fromY + dy * t)) return false;
  }
  return true;
}
```

`LineOfSightBlocker` is a minimal structural interface (same pattern as `StatusEffectSource`), so it's testable with a fake grid and satisfied structurally by a real tilemap query in production. Sampling every 12px is cheap since this only runs once per attack-attempt (~every 1.5s per enemy), not every frame.

## `EnemyCombat` wiring

`getAvailableAttacks` (aggression + cooldown) is unchanged. `EnemyCombat.update()` applies range/LOS as an additional filter afterward, per-attack, only checking fields that attack actually declares:

```ts
const byAggressionAndCooldown = getAvailableAttacks(this.enemy.aggressionLevel, this.cooldowns);
const available = byAggressionAndCooldown.filter((attack) => {
  if (attack.maxRangeTiles !== undefined &&
      !isWithinRange(this.enemy.x, this.enemy.y, target.x, target.y, attack.maxRangeTiles * TILE_SIZE)) {
    return false;
  }
  if (attack.requiresLineOfSight &&
      !hasLineOfSight(this.blocker, this.enemy.x, this.enemy.y, target.x, target.y)) {
    return false;
  }
  return true;
});
```

`EnemyCombat`'s constructor gains a new **required** parameter `blocker: LineOfSightBlocker` (after `getTarget`, before the existing `options`) — required, not defaulted, so a missing LOS wiring is a compile error rather than a silent "walls don't matter" fallback. Existing test call sites add a trivial stub: `{ isBlocked: () => false }`.

## `DungeonScene.ts` wiring

Inline object literal built in `create()`, closing over the scene's tilemap layers, reusing the same `.collides` flag Phaser already computes for player-movement collision:

```ts
const blocker: LineOfSightBlocker = {
  isBlocked: (x, y) =>
    !!this.groundLayer.getTileAtWorldXY(x, y)?.collides || !!this.stuffLayer.getTileAtWorldXY(x, y)?.collides,
};
```

Passed as the new third argument to each `new EnemyCombat(...)` call.

## Tests

- **New `lineOfSight.test.ts`**: `isWithinRange` in/out of range + boundary; `hasLineOfSight` with an always-open blocker (true), a blocker that blocks the sampled midpoint (false), and a blocker that only blocks points off the line (true - proves it's actually sampling, not just checking endpoints).
- **`EnemyCombat.test.ts`**: all 9 existing constructor calls gain the stub blocker (no behavior change - existing `makeEntity` positions enemy/player at the same point, trivially in range with a permissive blocker). New cases: out-of-range excludes an attack; blocked LOS excludes an attack; in-range + clear LOS includes it; a synthetic attack with neither field set stays available regardless of distance/blocker (proves decoupling).
- **`Attack.test.ts`**: catalog invariant that all three current attacks have `requiresLineOfSight: true` and `maxRangeTiles: 8`.
- **Manual**: `tsc`/`next build`/`vitest run`, then a browser check comparing screenshots with the player kept in the enemy's room (badges should appear) vs. a separate room behind walls (badges should stay absent).
