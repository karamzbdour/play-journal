# Player Weapon Assignment — Design

## Goal

Attach a `Weapon` (from the existing `combat/Weapon.ts` model) to the player entity when a
dungeon run starts, so later combat work has something concrete to read from. Data assignment
only — no attacking, no damage, no UI changes.

## Scope

- A new `randomWeaponCategory()` helper in `combat/Weapon.ts` that picks uniformly between the
  two existing `WeaponCategory` values (`"melee"`, `"longMelee"`).
- `Player` gains a `weapon: Weapon` constructor parameter, stored as a public field
  (`public weapon: Weapon`), the same way it already stores `public statusEffects`.
- `DungeonScene.create()` generates the weapon (`generateWeapon(randomWeaponCategory())`) at the
  same point it creates the player, and passes it into `new Player(...)` — mirroring how it
  already computes `aggressionLevel` and passes it into `new Enemy(...)` rather than letting
  `Enemy` generate its own config.

Out of scope: any player-initiated attack, damage/health, reading `player.weapon` from
`EntityLabel` or any other UI, and any link to `GameConfig.weapon` (the Gemini-generated flavor
string shown in the journal book UI — unrelated string, not touched by this change).

## Data model

### `src/game/combat/Weapon.ts`

```ts
// Uniform 50/50 pick — no design reason yet to weight one category over the other.
export function randomWeaponCategory(): WeaponCategory {
  return Math.random() < 0.5 ? "melee" : "longMelee";
}
```

Placed alongside `randomAttackCount`, same style: a thin `Math.random()` wrapper, easy to test
by mocking `Math.random`.

### `src/game/entities/Player.ts`

```ts
export default class Player {
  public sprite: Phaser.GameObjects.Arc;
  public statusEffects: StatusEffectController = new StatusEffectController();
  public weapon: Weapon;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, x: number, y: number, weapon: Weapon) {
    this.weapon = weapon;
    // ...unchanged sprite/body/cursors setup
  }
}
```

### `src/game/scenes/DungeonScene.ts`

In `create()`, right before `this.player = new Player(...)`:

```ts
const weapon = generateWeapon(randomWeaponCategory());
this.player = new Player(this, playerX, playerY, weapon);
```

No other scene changes — `player.weapon` is stored and unread for now, same status as
`enemy.aggressionLevel` was before `EnemyCombat` existed to consume it.

## Testing

- `Weapon.test.ts` gains a `describe("randomWeaponCategory", ...)` block: mock `Math.random` to
  return a value `< 0.5` and assert `"melee"`, then `>= 0.5` and assert `"longMelee"` — same
  pattern as the existing `randomAttackCount` tests in that file.
- No new `Player` test file. `Enemy.ts` has no test file either — these are thin Phaser-wrapper
  classes (sprite/body/input setup) with no test infra in this repo for that layer; the logic
  worth unit-testing (category/weapon generation) already lives in `Weapon.ts`.

## Verification

- `npx tsc --noEmit` and the existing Vitest suite (`Weapon.test.ts`) pass.
- Manually confirm no runtime regression: run the dev server, start a game, confirm the player
  still spawns and moves normally (weapon assignment shouldn't be visible yet — there's no UI
  for it).
