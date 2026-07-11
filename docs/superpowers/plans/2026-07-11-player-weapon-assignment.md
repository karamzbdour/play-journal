# Player Weapon Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach a randomly-generated `Weapon` to the player when a dungeon run starts, as a data-only field with no attacking, damage, or UI behavior yet.

**Architecture:** Add a `randomWeaponCategory()` helper to the existing `combat/Weapon.ts` module. `Player` accepts a `Weapon` via its constructor and stores it as a public field, the same way it already stores `statusEffects`. `DungeonScene.create()` generates the weapon and passes it into `Player`'s constructor, mirroring how it already passes a computed `aggressionLevel` into `Enemy`'s constructor.

**Tech Stack:** TypeScript, Phaser 3, Vitest (frontend workspace at `frontend/`, all commands below run with `frontend/` as the working directory).

## Global Constraints

- Data assignment only — no player-initiated attacks, no damage/health system, no UI changes. (Spec: "Out of scope")
- `player.weapon` must not be read by `EntityLabel` or any other UI in this plan. (Spec: "Out of scope")
- `GameConfig.weapon` (the Gemini flavor string used in the journal book UI) must not be touched or referenced. (Spec: "Out of scope")
- `randomWeaponCategory()` must be a uniform 50/50 pick between `"melee"` and `"longMelee"`, with no weighting. (Spec: "Data model")

---

### Task 1: Add `randomWeaponCategory()` to the weapon model

**Files:**
- Modify: `frontend/src/game/combat/Weapon.ts`
- Test: `frontend/src/game/combat/Weapon.test.ts`

**Interfaces:**
- Consumes: nothing new — uses the existing exported `WeaponCategory` type already defined in this file (`frontend/src/game/combat/Weapon.ts:3`).
- Produces: `export function randomWeaponCategory(): WeaponCategory` — a zero-argument function returning `"melee"` or `"longMelee"`. Task 2 imports this from `"../combat/Weapon"`.

- [ ] **Step 1: Write the failing tests**

Open `frontend/src/game/combat/Weapon.test.ts`. Update the import on line 2 to also pull in `randomWeaponCategory`:

```ts
import { CATEGORY_BASE_STATS, randomAttackCount, randomWeaponCategory, pickUnique, generateWeapon } from "./Weapon";
```

Then insert a new `describe` block directly after the existing `describe("CATEGORY_BASE_STATS", ...)` block (after line 11, before line 13's `describe("randomAttackCount", ...)`):

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/game/combat/Weapon.test.ts`

Expected: FAIL — `randomWeaponCategory is not exported` / `is not a function` (the import will fail to resolve since the export doesn't exist yet).

- [ ] **Step 3: Implement `randomWeaponCategory`**

In `frontend/src/game/combat/Weapon.ts`, insert this new function directly after the `CATEGORY_BASE_STATS` constant closes (after line 23), before the `// Weighted toward fewer attacks...` comment on line 25:

```ts
// Uniform 50/50 pick - no design reason yet to weight one category over the other.
export function randomWeaponCategory(): WeaponCategory {
  return Math.random() < 0.5 ? "melee" : "longMelee";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/game/combat/Weapon.test.ts`

Expected: PASS — all tests in the file green, including the two new `randomWeaponCategory` tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/Weapon.ts frontend/src/game/combat/Weapon.test.ts
git commit -m "Add randomWeaponCategory helper"
```

---

### Task 2: Give the player a weapon

**Files:**
- Modify: `frontend/src/game/entities/Player.ts`
- Modify: `frontend/src/game/scenes/DungeonScene.ts`

**Interfaces:**
- Consumes: `generateWeapon(category: WeaponCategory): Weapon` and `randomWeaponCategory(): WeaponCategory`, both exported from `frontend/src/game/combat/Weapon.ts` (the latter added in Task 1; `generateWeapon` and the `Weapon` type already exist).
- Produces: `Player`'s constructor signature becomes `constructor(scene: Phaser.Scene, x: number, y: number, weapon: Weapon)`, and instances expose `public weapon: Weapon`. No later task in this plan consumes this, but it's the deliverable the spec calls for.

This task has no unit test of its own — per the spec, `Player.ts` and `DungeonScene.ts` follow the existing precedent of `Enemy.ts` (no dedicated test file for these thin Phaser-wrapper/wiring classes). Verification is done via typecheck, the existing test suite, and a manual run (Steps 3-4).

- [ ] **Step 1: Update `Player.ts` to accept and store a weapon**

In `frontend/src/game/entities/Player.ts`, add an import for `Weapon` at the top of the file (after the existing `StatusEffectController` import on line 2):

```ts
import { Weapon } from "../combat/Weapon";
```

Add a public field and update the constructor signature. Replace lines 10-21:

```ts
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
```

with:

```ts
export default class Player {
  public sprite: Phaser.GameObjects.Arc;
  public statusEffects: StatusEffectController = new StatusEffectController();
  public weapon: Weapon;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, x: number, y: number, weapon: Weapon) {
    this.weapon = weapon;
    this.sprite = scene.add.circle(x, y, 8, 0xfacc15);
    scene.physics.add.existing(this.sprite);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    this.cursors = scene.input.keyboard!.createCursorKeys();
  }
```

- [ ] **Step 2: Update `DungeonScene.ts` to generate and pass the weapon**

In `frontend/src/game/scenes/DungeonScene.ts`, update the import on line 6 (currently `import Enemy from "../entities/Enemy";`) — add a new import line directly below it:

```ts
import { generateWeapon, randomWeaponCategory } from "../combat/Weapon";
```

Then update the player-creation call. Replace lines 118-122:

```ts
      const startRoom = dungeon.rooms[0];
      const playerX = map.tileToWorldX(startRoom.centerX)!;
      const playerY = map.tileToWorldY(startRoom.centerY)!;
      this.player = new Player(this, playerX, playerY);
      this.cameras.main.startFollow(this.player.sprite, true);
```

with:

```ts
      const startRoom = dungeon.rooms[0];
      const playerX = map.tileToWorldX(startRoom.centerX)!;
      const playerY = map.tileToWorldY(startRoom.centerY)!;
      const weapon = generateWeapon(randomWeaponCategory());
      this.player = new Player(this, playerX, playerY, weapon);
      this.cameras.main.startFollow(this.player.sprite, true);
```

- [ ] **Step 3: Typecheck and run the full test suite**

Run (from `frontend/`): `npx tsc --noEmit`

Expected: no errors (confirms `Player`'s new required constructor parameter has exactly one call site, and it now supplies a `Weapon`).

Run (from `frontend/`): `npx vitest run`

Expected: PASS — full existing suite green, no regressions.

- [ ] **Step 4: Manually verify no runtime regression**

Run (from `frontend/`): `npm run dev`

Open the app in a browser, use "Preview with mock data" (or generate a game) to reach `/play`, and confirm:
- The dungeon loads and the player spawns and moves normally with arrow keys.
- No console errors on load (weapon assignment has no visible effect yet, which is expected — there's no UI for it in this plan).

Stop the dev server afterward.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/entities/Player.ts frontend/src/game/scenes/DungeonScene.ts
git commit -m "Assign a randomly generated weapon to the player on spawn"
```
