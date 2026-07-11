# Player Combat (Basic Attack + Abilities) — Design

## Goal

Give the player a way to actually fight back: SPACE swings the equipped weapon's basic attack,
and Q/W/E fire up to three weapon-specific abilities drawn from `weapon.attackIds`. Effects-only,
same as `EnemyCombat` today — no health/damage system yet.

## Scope

- A `PlayerCombat` class, input-driven (not timer-driven like `EnemyCombat`), owned by
  `DungeonScene` and ticked every frame.
- SPACE: basic attack, gated by `weapon.attackSpeedMs`. On hit, applies a short `slow` to the
  nearest qualifying enemy. Not one of the weapon's `attackIds` - a fixed action every weapon has.
- Q/W/E: abilities, mapped positionally to `weapon.attackIds[0]`, `[1]`, `[2]`. Each ability gets
  its own cooldown (`WeaponAttackDefinition.cooldownMs`, new field). A weapon with fewer than 3
  `attackIds` leaves the unused key(s) doing nothing.
- Targeting: nearest enemy within `weapon.rangeTiles` (converted to world units) with line-of-sight,
  reusing `lineOfSight.ts` - the same mechanism `EnemyCombat` already uses against the player.
- Whether an ability needs a target at all is derived from its own effect list, not a new field:
  if any effect application has `target: "target"`, the ability needs a qualifying enemy to fire;
  if every effect targets `"self"`, it fires unconditionally (no range/LoS gate). The basic attack
  and all target-directed abilities always attempt to fire on a just-press regardless of whether a
  target is found - a miss ("whiff") still starts that action's cooldown.
- Input handling goes behind a small interface (`AttackInput`) so `PlayerCombat`'s targeting/
  cooldown/effect logic is unit-testable without a real Phaser scene - the same reason
  `EnemyCombat` takes injectable `trigger`/`selector` functions instead of hardcoding real timers.

Out of scope: damage, enemy health/death, any UI (ability icons, cooldown bars), attack
animations/visual feedback beyond what `EntityLabel`'s existing status badges already show,
changes to `Player.ts` beyond what's already there (it already exposes `weapon` and
`statusEffects`), and gamepad/touch input.

## Data model

### `src/game/combat/WeaponAttack.ts`

`WeaponAttackDefinition` gains `cooldownMs`. Placeholder values in the same spirit as enemy
`Attack.ts`'s 4000-6000ms range - tunable later, not load-bearing for correctness:

```ts
export interface WeaponAttackDefinition {
  id: string;
  name: string;
  cooldownMs: number;
  effects: AttackEffectApplication[];
}

export const WEAPON_ATTACKS: WeaponAttackDefinition[] = [
  { id: "quick_slash", name: "Quick Slash", cooldownMs: 2000, effects: [] },
  { id: "puncture", name: "Puncture", cooldownMs: 3000,
    effects: [{ effectId: "slow", target: "target", durationMs: 2000 }] },
  { id: "intimidating_strike", name: "Intimidating Strike", cooldownMs: 4000,
    effects: [{ effectId: "suppressed", target: "target", durationMs: 2500 }] },
  { id: "battle_focus", name: "Battle Focus", cooldownMs: 5000,
    effects: [{ effectId: "unstoppable", target: "self", durationMs: 3000 }] },
  { id: "power_swing", name: "Power Swing", cooldownMs: 4000,
    effects: [{ effectId: "bonus_damage", target: "self", durationMs: 2000 }] },
  { id: "heavy_strike", name: "Heavy Strike", cooldownMs: 3000,
    effects: [{ effectId: "charge_time", target: "self", durationMs: 1200 }] },
];
```

`quick_slash` has no effects at all, so by the "needs a target" rule it's vacuously self-only -
pressing its key just resets its cooldown with no other observable effect. That's an accepted
placeholder outcome, not a bug: it already exists as "a plain hit" per `WeaponAttack.test.ts`.

### `src/game/combat/PlayerCombat.ts` (new)

```ts
export interface AttackInput {
  isBasicAttackJustPressed(): boolean;
  isAbilityJustPressed(slot: 0 | 1 | 2): boolean;
}

export class PhaserAttackInput implements AttackInput {
  constructor(scene: Phaser.Scene);
  isBasicAttackJustPressed(): boolean;
  isAbilityJustPressed(slot: 0 | 1 | 2): boolean;
}

export default class PlayerCombat {
  constructor(
    weapon: Weapon,
    self: CombatEntity,
    getEnemies: () => CombatEntity[],
    blocker: LineOfSightBlocker,
    input: AttackInput
  );
  update(deltaMs: number): void;
}
```

- Reuses `CombatEntity` (`{ x, y, statusEffects }`) from `EnemyCombat.ts` - same shape already
  used for both sides of combat there, no need for a second definition.
- `PhaserAttackInput` binds SPACE/Q/W/E via `scene.input.keyboard.addKey("SPACE" | "Q" | "W" | "E")`
  and tracks each key's down-state from the previous frame to detect "just pressed" - no
  dependency on Phaser's static `JustDown` helper, matching how `Player.ts` already avoids
  importing the Phaser runtime (only `import type Phaser`).
- `update(deltaMs)`: ticks the basic-attack cooldown and a `Map<attackId, remainingMs>` for
  abilities, then checks `input.isBasicAttackJustPressed()` and
  `input.isAbilityJustPressed(0|1|2)` once each.
- Basic attack: if cooldown elapsed and just-pressed, starts `weapon.attackSpeedMs` cooldown,
  finds the nearest qualifying enemy (range `weapon.rangeTiles * TILE_SIZE` + line-of-sight), and
  if found applies `slow` for 500ms to it. No target found -> cooldown still starts.
- Ability slot `n`: reads `weapon.attackIds[n]`; if absent, does nothing. Otherwise looks up its
  `WeaponAttackDefinition`, checks its own cooldown, and if elapsed and just-pressed: if any effect
  targets `"target"`, requires a qualifying nearest enemy (starts cooldown regardless of whether
  one was found); if all effects target `"self"`, always starts the cooldown and applies effects
  to `self` directly. For each effect application, `target === "self"` resolves to `self`,
  `"target"` resolves to the found enemy.

## `DungeonScene.ts` wiring

After `enemyCombats` is built, construct one `PlayerCombat`:

```ts
const playerSelf: CombatEntity = {
  get x() { return this.player.sprite.x; },
  get y() { return this.player.sprite.y; },
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

`scene.update()` calls `this.playerCombat.update(delta)` alongside the existing
`enemyCombats.forEach(...)`.

## Testing

- `WeaponAttack.test.ts`: add an assertion that every `WEAPON_ATTACKS` entry has `cooldownMs > 0`.
- `PlayerCombat.test.ts` (new), using a fake `AttackInput` (no real Phaser scene needed):
  - Basic attack does nothing before its cooldown elapses, and applies `slow` to the nearest
    in-range enemy once pressed and off cooldown.
  - Basic attack whiff (no qualifying enemy) still starts the cooldown.
  - Ability slot fires the correct `weapon.attackIds[n]` definition; a missing slot is a no-op.
  - Target-directed ability effect goes to the enemy, not the player; self-directed effect goes to
    the player, not the enemy.
  - Self-only ability fires with no enemy present at all.
  - Target-directed ability does nothing (but still starts its cooldown) when out of range or
    blocked by line-of-sight.
  - Each ability's cooldown is independent of the others and of the basic attack's cooldown.

## Verification

- `npx tsc --noEmit` and the full Vitest suite pass.
- Manual check via the running dev server: confirm SPACE/Q/W/E each visibly apply their status
  badge (via `EntityLabel`) to the demo enemy when in range, and do nothing when out of range or
  behind a wall.
