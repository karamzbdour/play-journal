# Sprite Animation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Player`/`Enemy`'s placeholder circle rendering with a sprite/animation system that plays idle/walk/attack/hit/death states, tolerates sprites that only define a subset of those states, and falls back gracefully for sprite ids the system doesn't recognize.

**Architecture:** A pure data/resolver layer (`SpriteManifest` types, a `SpriteProvider` interface with a `LocalSpriteProvider` mock, and pure `resolveAnimation.ts` functions for fallback + interrupt-priority logic) underneath a thin Phaser-facing `AnimationController` owned by `Player`/`Enemy`. `DungeonScene` resolves both entities' manifests and loads their textures before construction. Attack animations are triggered via an explicit `onAttack` callback on `PlayerCombat`/`EnemyCombat`; idle/walk/hit/death are polled each frame from data those entities already have (velocity, health).

**Tech Stack:** TypeScript, Phaser 4, Vitest. New devDependency: `pngjs` (pure-JS PNG encoder, used only by a one-time placeholder-asset generation script — not shipped in the app bundle).

## Global Constraints

- Sprite ids (`GameConfig.player_sprite`, `GameConfig.enemy_type`) are freeform strings, not a fixed enum — the system must not assume a closed set of names.
- A sprite manifest may define only a subset of the six `AnimationState`s (`idle`, `walk`, `dash`, `attack`, `hit`, `death`).
- Missing individual state → falls back to that sprite's `walk` clip, then its `idle` clip.
- A missing per-ability attack clip (`` attack:${abilityId} ``) falls back to the sprite's generic `attack` clip before falling further back to walk/idle.
- Unknown sprite id, failed fetch, or a texture that fails to actually download → substitute the full generic manifest for that entity kind (`generic_humanoid` for player, `generic_enemy` for enemy).
- The two generic manifests are the only manifests required to define all six states.
- `"dash"` is a reserved `AnimationState` with no gameplay trigger in this pass — do not wire it to any input or mechanic.
- The real DB-backed `SpriteProvider` is out of scope; ship `LocalSpriteProvider` only, as a drop-in-replaceable interface implementation.
- `AnimationController` is Phaser-facing glue and is **not** unit-tested directly — the pure functions it depends on (`resolveClip`, `shouldInterrupt`, `pickManifest`) are, matching the existing `EntityLabel`/`diffBadgeIds` split in this codebase.
- Interrupt priority for the currently playing animation: `death` > `attack` > `hit` > `walk`/`idle`/`dash`. `death` latches permanently once triggered.
- `resolveAttackComponents`, `PlayerCombat`, `EnemyCombat` stay Phaser-free — no `AnimationController` reference is threaded through them; attack animation is wired via an optional constructor callback instead.

Spec: `docs/superpowers/specs/2026-07-12-animation-setup-design.md`

---

## File Structure

New files:
- `frontend/src/game/animation/SpriteManifest.ts` — pure types.
- `frontend/src/game/animation/SpriteProvider.ts` — `SpriteProvider` interface, the two generic manifest constants, `LocalSpriteProvider`.
- `frontend/src/game/animation/resolveAnimation.ts` — `pickManifest`, `resolveClip`, `shouldInterrupt`.
- `frontend/src/game/animation/AnimationController.ts` — Phaser-facing controller.
- `frontend/tests/game/animation/SpriteProvider.test.ts`
- `frontend/tests/game/animation/resolveAnimation.test.ts`
- `frontend/scripts/generate-placeholder-sprites.mjs` — one-time script, run during implementation, that writes the placeholder PNGs.
- `frontend/public/sprites/*.png` — 12 generated placeholder spritesheets (2 sprites × 6 states).

Modified files:
- `frontend/src/game/entities/Player.ts` — `Arc` → `Sprite`, owns an `AnimationController`.
- `frontend/src/game/entities/Enemy.ts` — same.
- `frontend/src/game/combat/PlayerCombat.ts` — optional `onAttack` callback.
- `frontend/src/game/combat/EnemyCombat.ts` — optional `onAttack` callback.
- `frontend/src/game/scenes/DungeonScene.ts` — async `create()`, manifest resolution + texture loading, wiring.
- `frontend/package.json` — add `pngjs` devDependency.
- `frontend/tests/game/combat/PlayerCombat.test.ts` — new tests for `onAttack`.
- `frontend/tests/game/combat/EnemyCombat.test.ts` — new tests for `onAttack`.

---

### Task 1: Sprite manifest types

**Files:**
- Create: `frontend/src/game/animation/SpriteManifest.ts`

**Interfaces:**
- Produces: `AnimationState`, `ManifestKey`, `ClipDef`, `SpriteManifest` — used by every later task in this plan.

No test file — this is a pure type module with no runtime behavior, matching the existing precedent of `frontend/src/game/combat/CombatEntity.ts` (also untested).

- [ ] **Step 1: Create the file**

```ts
export type AnimationState = "idle" | "walk" | "dash" | "attack" | "hit" | "death";

// Attacks can optionally get their own clip, keyed by ability id (e.g. "attack:puncture").
// Falls back to the plain "attack" clip if a sprite doesn't define one for a given ability -
// see resolveAnimation.ts's resolveClip.
export type ManifestKey = AnimationState | `attack:${string}`;

export interface ClipDef {
  textureKey: string; // unique per spriteId+state; used as both the Phaser texture key and animation key
  textureUrl: string; // where to download the spritesheet from
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameRate: number;
  repeat: number; // -1 for looping (idle/walk/dash), 0 for one-shot (attack/hit/death)
}

export interface SpriteManifest {
  spriteId: string;
  clips: Partial<Record<ManifestKey, ClipDef>>;
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/animation/SpriteManifest.ts
git commit -m "Add sprite animation manifest types"
```

---

### Task 2: SpriteProvider interface, generic manifests, LocalSpriteProvider

**Files:**
- Create: `frontend/src/game/animation/SpriteProvider.ts`
- Test: `frontend/tests/game/animation/SpriteProvider.test.ts`

**Interfaces:**
- Consumes: `AnimationState`, `ClipDef`, `SpriteManifest` (Task 1).
- Produces: `SpriteProvider` interface, `GENERIC_HUMANOID_MANIFEST`, `GENERIC_ENEMY_MANIFEST`, `LocalSpriteProvider` — consumed by `resolveAnimation.ts` (Task 3), `DungeonScene.ts` (Task 10), and this task's own test.

The frame counts below (`idle: 2`, `walk: 4`, `dash: 3`, `attack: 3`, `hit: 2`, `death: 4`) must match the `STATES` table in the asset-generation script (Task 5) — that script produces spritesheets with exactly these many frames per state.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/game/animation/SpriteProvider.test.ts
import { describe, it, expect } from "vitest";
import { LocalSpriteProvider, GENERIC_HUMANOID_MANIFEST, GENERIC_ENEMY_MANIFEST } from "@/game/animation/SpriteProvider";
import { AnimationState } from "@/game/animation/SpriteManifest";

const ALL_STATES: AnimationState[] = ["idle", "walk", "dash", "attack", "hit", "death"];

describe("generic manifests", () => {
  it("generic_humanoid defines every animation state", () => {
    for (const state of ALL_STATES) {
      expect(GENERIC_HUMANOID_MANIFEST.clips[state]).toBeDefined();
    }
  });

  it("generic_enemy defines every animation state", () => {
    for (const state of ALL_STATES) {
      expect(GENERIC_ENEMY_MANIFEST.clips[state]).toBeDefined();
    }
  });

  it("generic_humanoid and generic_enemy use distinct texture keys", () => {
    expect(GENERIC_HUMANOID_MANIFEST.clips.idle!.textureKey).not.toBe(GENERIC_ENEMY_MANIFEST.clips.idle!.textureKey);
  });
});

describe("LocalSpriteProvider", () => {
  it("resolves a manifest for the known 'programmer' sprite id", async () => {
    const provider = new LocalSpriteProvider();
    const manifest = await provider.getManifest("programmer");
    expect(manifest?.spriteId).toBe("programmer");
    expect(manifest?.clips.idle).toBeDefined();
  });

  it("resolves a manifest for the known 'bug' sprite id", async () => {
    const provider = new LocalSpriteProvider();
    const manifest = await provider.getManifest("bug");
    expect(manifest?.spriteId).toBe("bug");
  });

  it("resolves null for an unrecognized sprite id", async () => {
    const provider = new LocalSpriteProvider();
    const manifest = await provider.getManifest("some_totally_unknown_sprite");
    expect(manifest).toBeNull();
  });

  it("the 'programmer' manifest deliberately omits attack/hit/dash clips, to exercise fallback", async () => {
    const provider = new LocalSpriteProvider();
    const manifest = await provider.getManifest("programmer");
    expect(manifest?.clips.attack).toBeUndefined();
    expect(manifest?.clips.hit).toBeUndefined();
    expect(manifest?.clips.dash).toBeUndefined();
    expect(manifest?.clips.idle).toBeDefined();
    expect(manifest?.clips.walk).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/animation/SpriteProvider.test.ts`
Expected: FAIL with a module-not-found error for `@/game/animation/SpriteProvider`.

- [ ] **Step 3: Implement**

```ts
// frontend/src/game/animation/SpriteProvider.ts
import { AnimationState, ClipDef, SpriteManifest } from "./SpriteManifest";

export interface SpriteProvider {
  getManifest(spriteId: string): Promise<SpriteManifest | null>;
}

function clip(spriteId: string, state: AnimationState, opts: { frameCount: number; frameRate: number; repeat: number }): ClipDef {
  return {
    textureKey: `${spriteId}_${state}`,
    textureUrl: `/sprites/${spriteId}_${state}.png`,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: opts.frameCount,
    frameRate: opts.frameRate,
    repeat: opts.repeat,
  };
}

// Fully populated (all six AnimationStates) - the only manifests required to be complete, and
// the guaranteed-safe fallback target for any sprite id resolveAnimation.ts can't otherwise
// resolve. Frame counts here must match frontend/scripts/generate-placeholder-sprites.mjs.
function buildGenericManifest(spriteId: string): SpriteManifest {
  return {
    spriteId,
    clips: {
      idle: clip(spriteId, "idle", { frameCount: 2, frameRate: 4, repeat: -1 }),
      walk: clip(spriteId, "walk", { frameCount: 4, frameRate: 8, repeat: -1 }),
      dash: clip(spriteId, "dash", { frameCount: 3, frameRate: 12, repeat: -1 }),
      attack: clip(spriteId, "attack", { frameCount: 3, frameRate: 10, repeat: 0 }),
      hit: clip(spriteId, "hit", { frameCount: 2, frameRate: 10, repeat: 0 }),
      death: clip(spriteId, "death", { frameCount: 4, frameRate: 6, repeat: 0 }),
    },
  };
}

export const GENERIC_HUMANOID_MANIFEST: SpriteManifest = buildGenericManifest("generic_humanoid");
export const GENERIC_ENEMY_MANIFEST: SpriteManifest = buildGenericManifest("generic_enemy");

// Dev/test implementation - a couple of hardcoded, deliberately sparse manifests (matching
// mockGameConfig's player_sprite: "programmer" and enemy_type: "bug"), reusing the generic
// manifests' clips/art so no extra placeholder assets are needed. Unknown ids resolve null so
// the fallback path is exercised. The real DB-backed provider implements this same interface
// later - no other code changes required to swap it in.
export class LocalSpriteProvider implements SpriteProvider {
  private manifests: Record<string, SpriteManifest> = {
    programmer: {
      spriteId: "programmer",
      clips: {
        idle: GENERIC_HUMANOID_MANIFEST.clips.idle!,
        walk: GENERIC_HUMANOID_MANIFEST.clips.walk!,
        death: GENERIC_HUMANOID_MANIFEST.clips.death!,
      },
    },
    bug: {
      spriteId: "bug",
      clips: {
        idle: GENERIC_ENEMY_MANIFEST.clips.idle!,
        walk: GENERIC_ENEMY_MANIFEST.clips.walk!,
        death: GENERIC_ENEMY_MANIFEST.clips.death!,
      },
    },
  };

  async getManifest(spriteId: string): Promise<SpriteManifest | null> {
    return this.manifests[spriteId] ?? null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/animation/SpriteProvider.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/animation/SpriteProvider.ts frontend/tests/game/animation/SpriteProvider.test.ts
git commit -m "Add SpriteProvider interface, generic manifests, and LocalSpriteProvider"
```

---

### Task 3: resolveAnimation.ts — pure resolver and fallback logic

**Files:**
- Create: `frontend/src/game/animation/resolveAnimation.ts`
- Test: `frontend/tests/game/animation/resolveAnimation.test.ts`

**Interfaces:**
- Consumes: `AnimationState`, `ClipDef`, `ManifestKey`, `SpriteManifest` (Task 1); `GENERIC_HUMANOID_MANIFEST`, `GENERIC_ENEMY_MANIFEST` (Task 2).
- Produces: `pickManifest(spriteKind: "player" | "enemy", fetched: SpriteManifest | null): SpriteManifest`, `resolveClip(manifest: SpriteManifest, requested: ManifestKey): ClipDef`, `shouldInterrupt(current: AnimationState, requested: AnimationState): boolean` — consumed by `AnimationController.ts` (Task 4) and `DungeonScene.ts` (Task 10).

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/tests/game/animation/resolveAnimation.test.ts
import { describe, it, expect } from "vitest";
import { pickManifest, resolveClip, shouldInterrupt } from "@/game/animation/resolveAnimation";
import { GENERIC_HUMANOID_MANIFEST, GENERIC_ENEMY_MANIFEST } from "@/game/animation/SpriteProvider";
import { SpriteManifest } from "@/game/animation/SpriteManifest";

describe("pickManifest", () => {
  it("uses the fetched manifest when it has an idle clip", () => {
    const fetched: SpriteManifest = { spriteId: "custom", clips: { idle: GENERIC_HUMANOID_MANIFEST.clips.idle! } };
    expect(pickManifest("player", fetched)).toBe(fetched);
  });

  it("uses the fetched manifest when it only has a walk clip", () => {
    const fetched: SpriteManifest = { spriteId: "custom", clips: { walk: GENERIC_HUMANOID_MANIFEST.clips.walk! } };
    expect(pickManifest("player", fetched)).toBe(fetched);
  });

  it("falls back to the generic humanoid manifest when fetch returned null", () => {
    expect(pickManifest("player", null)).toBe(GENERIC_HUMANOID_MANIFEST);
  });

  it("falls back to the generic enemy manifest when fetch returned null", () => {
    expect(pickManifest("enemy", null)).toBe(GENERIC_ENEMY_MANIFEST);
  });

  it("falls back to generic when the fetched manifest has neither idle nor walk", () => {
    const fetched: SpriteManifest = { spriteId: "custom", clips: { attack: GENERIC_HUMANOID_MANIFEST.clips.attack! } };
    expect(pickManifest("player", fetched)).toBe(GENERIC_HUMANOID_MANIFEST);
  });
});

describe("resolveClip", () => {
  it("returns the exact clip when present", () => {
    expect(resolveClip(GENERIC_HUMANOID_MANIFEST, "walk")).toBe(GENERIC_HUMANOID_MANIFEST.clips.walk);
  });

  it("falls back to walk when the requested state is missing", () => {
    const manifest: SpriteManifest = { spriteId: "custom", clips: { walk: GENERIC_HUMANOID_MANIFEST.clips.walk! } };
    expect(resolveClip(manifest, "attack")).toBe(manifest.clips.walk);
  });

  it("falls back to idle when both the requested state and walk are missing", () => {
    const manifest: SpriteManifest = { spriteId: "custom", clips: { idle: GENERIC_HUMANOID_MANIFEST.clips.idle! } };
    expect(resolveClip(manifest, "attack")).toBe(manifest.clips.idle);
  });

  it("resolves an exact per-ability attack clip when present", () => {
    const abilityClip = GENERIC_HUMANOID_MANIFEST.clips.attack!;
    const manifest: SpriteManifest = {
      spriteId: "custom",
      clips: { idle: GENERIC_HUMANOID_MANIFEST.clips.idle!, "attack:puncture": abilityClip },
    };
    expect(resolveClip(manifest, "attack:puncture")).toBe(abilityClip);
  });

  it("falls back to the generic attack clip when a per-ability clip is missing", () => {
    const genericAttack = GENERIC_HUMANOID_MANIFEST.clips.attack!;
    const manifest: SpriteManifest = { spriteId: "custom", clips: { idle: GENERIC_HUMANOID_MANIFEST.clips.idle!, attack: genericAttack } };
    expect(resolveClip(manifest, "attack:puncture")).toBe(genericAttack);
  });

  it("falls further back to walk when a per-ability clip and the generic attack clip are both missing", () => {
    const manifest: SpriteManifest = { spriteId: "custom", clips: { walk: GENERIC_HUMANOID_MANIFEST.clips.walk! } };
    expect(resolveClip(manifest, "attack:puncture")).toBe(manifest.clips.walk);
  });

  it("throws when a manifest has neither the requested state nor walk nor idle", () => {
    const manifest: SpriteManifest = { spriteId: "custom", clips: { attack: GENERIC_HUMANOID_MANIFEST.clips.attack! } };
    expect(() => resolveClip(manifest, "hit")).toThrow();
  });
});

describe("shouldInterrupt", () => {
  it("never interrupts itself", () => {
    expect(shouldInterrupt("idle", "idle")).toBe(false);
    expect(shouldInterrupt("attack", "attack")).toBe(false);
  });

  it("death always latches - nothing interrupts it", () => {
    expect(shouldInterrupt("death", "idle")).toBe(false);
    expect(shouldInterrupt("death", "attack")).toBe(false);
    expect(shouldInterrupt("death", "hit")).toBe(false);
  });

  it("death interrupts everything else", () => {
    expect(shouldInterrupt("idle", "death")).toBe(true);
    expect(shouldInterrupt("walk", "death")).toBe(true);
    expect(shouldInterrupt("attack", "death")).toBe(true);
    expect(shouldInterrupt("hit", "death")).toBe(true);
  });

  it("attack blocks walk/idle from interrupting it", () => {
    expect(shouldInterrupt("attack", "walk")).toBe(false);
    expect(shouldInterrupt("attack", "idle")).toBe(false);
  });

  it("hit blocks walk/idle from interrupting it", () => {
    expect(shouldInterrupt("hit", "walk")).toBe(false);
    expect(shouldInterrupt("hit", "idle")).toBe(false);
  });

  it("hit does not interrupt an in-progress attack", () => {
    expect(shouldInterrupt("attack", "hit")).toBe(false);
  });

  it("a new attack does interrupt a brief hit-react", () => {
    expect(shouldInterrupt("hit", "attack")).toBe(true);
  });

  it("walk and idle freely swap with each other", () => {
    expect(shouldInterrupt("idle", "walk")).toBe(true);
    expect(shouldInterrupt("walk", "idle")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/game/animation/resolveAnimation.test.ts`
Expected: FAIL with a module-not-found error for `@/game/animation/resolveAnimation`.

- [ ] **Step 3: Implement**

```ts
// frontend/src/game/animation/resolveAnimation.ts
import { AnimationState, ClipDef, ManifestKey, SpriteManifest } from "./SpriteManifest";
import { GENERIC_ENEMY_MANIFEST, GENERIC_HUMANOID_MANIFEST } from "./SpriteProvider";

export type SpriteKind = "player" | "enemy";

// A manifest is safe to resolve against only if it has at least one of the two states
// resolveClip's fallback chain bottoms out on. Generic manifests always qualify; this also
// catches a fetched manifest missing both (falls back to generic rather than resolveClip throwing).
function hasFallbackBase(manifest: SpriteManifest): boolean {
  return manifest.clips.idle !== undefined || manifest.clips.walk !== undefined;
}

export function pickManifest(spriteKind: SpriteKind, fetched: SpriteManifest | null): SpriteManifest {
  const generic = spriteKind === "player" ? GENERIC_HUMANOID_MANIFEST : GENERIC_ENEMY_MANIFEST;
  if (fetched && hasFallbackBase(fetched)) return fetched;
  return generic;
}

// Missing-state fallback chain: exact match -> (for attack:${abilityId}) generic "attack" ->
// "walk" -> "idle". pickManifest guarantees every manifest reaching this has idle or walk, so
// this only throws if called directly on a manifest that skipped pickManifest.
export function resolveClip(manifest: SpriteManifest, requested: ManifestKey): ClipDef {
  const exact = manifest.clips[requested];
  if (exact) return exact;

  if (requested.startsWith("attack:")) {
    const genericAttack = manifest.clips.attack;
    if (genericAttack) return genericAttack;
  }

  const walk = manifest.clips.walk;
  if (walk) return walk;

  const idle = manifest.clips.idle;
  if (idle) return idle;

  throw new Error(`Sprite "${manifest.spriteId}" has no idle or walk clip to fall back to`);
}

// death > attack > hit > walk/idle/dash. death latches (handled by the current === "death"
// check); hit doesn't interrupt an in-progress attack, but a new attack does interrupt hit.
const STATE_PRIORITY: Record<AnimationState, number> = {
  idle: 0,
  walk: 0,
  dash: 0,
  hit: 1,
  attack: 2,
  death: 3,
};

export function shouldInterrupt(current: AnimationState, requested: AnimationState): boolean {
  if (current === "death") return false;
  if (requested === current) return false;
  return STATE_PRIORITY[requested] > STATE_PRIORITY[current] || STATE_PRIORITY[current] === 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/animation/resolveAnimation.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/animation/resolveAnimation.ts frontend/tests/game/animation/resolveAnimation.test.ts
git commit -m "Add pure animation resolution: manifest fallback and interrupt priority"
```

---

### Task 4: AnimationController — Phaser-facing controller

**Files:**
- Create: `frontend/src/game/animation/AnimationController.ts`

**Interfaces:**
- Consumes: `AnimationState`, `ManifestKey`, `SpriteManifest` (Task 1); `resolveClip`, `shouldInterrupt` (Task 3).
- Produces: `AnimationController` class with `constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, manifest: SpriteManifest)`, `play(state: AnimationState, options?: { abilityId?: string }): void`, `update(healthRatio: number, isDead: boolean, isMoving: boolean): void` — consumed by `Player.ts`/`Enemy.ts` (Tasks 6-7), `PlayerCombat`/`EnemyCombat`'s `onAttack` wiring in `DungeonScene.ts` (Task 10).

No test file — thin Phaser glue over the already-tested pure functions, matching the `EntityLabel`/`diffBadgeIds` precedent (verified manually in Task 11 instead).

- [ ] **Step 1: Create the file**

```ts
// frontend/src/game/animation/AnimationController.ts
import type Phaser from "phaser";
import { AnimationState, ManifestKey, SpriteManifest } from "./SpriteManifest";
import { resolveClip, shouldInterrupt } from "./resolveAnimation";

export default class AnimationController {
  private currentState: AnimationState = "idle";
  private lastHealthRatio = 1;
  private lastIsMoving = false;
  private diedAlready = false;

  constructor(
    private scene: Phaser.Scene,
    private sprite: Phaser.GameObjects.Sprite,
    private manifest: SpriteManifest
  ) {
    (Object.keys(manifest.clips) as ManifestKey[]).forEach((key) => {
      const clipDef = manifest.clips[key]!;
      if (scene.anims.exists(clipDef.textureKey)) return;
      scene.anims.create({
        key: clipDef.textureKey,
        frames: scene.anims.generateFrameNumbers(clipDef.textureKey, { start: 0, end: clipDef.frameCount - 1 }),
        frameRate: clipDef.frameRate,
        repeat: clipDef.repeat,
      });
    });
    this.play("idle");
  }

  play(state: AnimationState, options?: { abilityId?: string }): void {
    if (!shouldInterrupt(this.currentState, state)) return;

    const requestedKey: ManifestKey = options?.abilityId ? `attack:${options.abilityId}` : state;
    const clip = resolveClip(this.manifest, requestedKey);

    this.currentState = state;
    this.sprite.play(clip.textureKey);

    if (clip.repeat === 0) {
      this.sprite.once("animationcomplete", () => {
        if (this.currentState === "death") return; // death latches even after its clip finishes
        this.play(this.lastIsMoving ? "walk" : "idle");
      });
    }
  }

  update(healthRatio: number, isDead: boolean, isMoving: boolean): void {
    this.lastIsMoving = isMoving;

    if (isDead) {
      if (!this.diedAlready) {
        this.diedAlready = true;
        this.play("death");
      }
      return;
    }

    if (healthRatio < this.lastHealthRatio) this.play("hit");
    this.lastHealthRatio = healthRatio;

    this.play(isMoving ? "walk" : "idle");
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/animation/AnimationController.ts
git commit -m "Add Phaser-facing AnimationController"
```

---

### Task 5: Generate placeholder spritesheets

**Files:**
- Create: `frontend/scripts/generate-placeholder-sprites.mjs`
- Create (generated, not hand-written): `frontend/public/sprites/generic_humanoid_idle.png`, `generic_humanoid_walk.png`, `generic_humanoid_dash.png`, `generic_humanoid_attack.png`, `generic_humanoid_hit.png`, `generic_humanoid_death.png`, `generic_enemy_idle.png`, `generic_enemy_walk.png`, `generic_enemy_dash.png`, `generic_enemy_attack.png`, `generic_enemy_hit.png`, `generic_enemy_death.png`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: the 12 PNG files at the URLs `GENERIC_HUMANOID_MANIFEST`/`GENERIC_ENEMY_MANIFEST` (Task 2) already point to (`/sprites/<spriteId>_<state>.png`). No code interface - this task's deliverable is the files on disk.

Each spritesheet is a horizontal strip of solid-color frames (frame brightness increases left to right, so playback is visibly animating even before real art exists), with a 1px darker border per frame for visual clarity. The two sprite ids get different base hues so player vs. enemy are distinguishable in the browser check in Task 11.

- [ ] **Step 1: Add the `pngjs` devDependency**

Run (from `frontend/`): `npm install --save-dev pngjs`
Expected: `frontend/package.json`'s `devDependencies` gains `"pngjs": "^7.0.0"` (or latest 7.x), and `frontend/package-lock.json` updates.

- [ ] **Step 2: Write the generation script**

```js
// frontend/scripts/generate-placeholder-sprites.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngjs from "pngjs";

const { PNG } = pngjs;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../public/sprites");

const FRAME_SIZE = 32;

// Must match the frameCount values in src/game/animation/SpriteProvider.ts's buildGenericManifest.
const STATES = [
  { name: "idle", frameCount: 2 },
  { name: "walk", frameCount: 4 },
  { name: "dash", frameCount: 3 },
  { name: "attack", frameCount: 3 },
  { name: "hit", frameCount: 2 },
  { name: "death", frameCount: 4 },
];

// [R, G, B] base color per sprite, so the two generic sprites are visually distinguishable.
const SPRITE_BASE_COLOR = {
  generic_humanoid: [56, 130, 246], // blue-ish
  generic_enemy: [220, 60, 60], // red-ish
};

function frameColor(base, frameIndex, frameCount) {
  const brightness = 0.55 + 0.45 * (frameCount === 1 ? 0 : frameIndex / (frameCount - 1));
  return base.map((channel) => Math.round(Math.min(255, channel * brightness)));
}

function writeSpritesheet(spriteId, state, frameCount) {
  const base = SPRITE_BASE_COLOR[spriteId];
  const width = FRAME_SIZE * frameCount;
  const png = new PNG({ width, height: FRAME_SIZE });

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    const [r, g, b] = frameColor(base, frameIndex, frameCount);
    for (let y = 0; y < FRAME_SIZE; y++) {
      for (let x = 0; x < FRAME_SIZE; x++) {
        const isBorder = x === 0 || y === 0 || x === FRAME_SIZE - 1 || y === FRAME_SIZE - 1;
        const px = frameIndex * FRAME_SIZE + x;
        const idx = (width * y + px) << 2;
        if (isBorder) {
          png.data[idx] = Math.round(r * 0.5);
          png.data[idx + 1] = Math.round(g * 0.5);
          png.data[idx + 2] = Math.round(b * 0.5);
        } else {
          png.data[idx] = r;
          png.data[idx + 1] = g;
          png.data[idx + 2] = b;
        }
        png.data[idx + 3] = 255;
      }
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `${spriteId}_${state}.png`);
  png.pack().pipe(fs.createWriteStream(outPath));
  console.log(`wrote ${outPath}`);
}

for (const spriteId of Object.keys(SPRITE_BASE_COLOR)) {
  for (const { name, frameCount } of STATES) {
    writeSpritesheet(spriteId, name, frameCount);
  }
}
```

- [ ] **Step 3: Run the script**

Run (from `frontend/`): `node scripts/generate-placeholder-sprites.mjs`
Expected: 12 lines of `wrote .../public/sprites/....png` output, no errors.

- [ ] **Step 4: Verify the files exist**

Run (from `frontend/`): `ls public/sprites`
Expected: 12 `.png` files, named `generic_humanoid_{idle,walk,dash,attack,hit,death}.png` and `generic_enemy_{idle,walk,dash,attack,hit,death}.png`.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/scripts/generate-placeholder-sprites.mjs frontend/public/sprites
git commit -m "Generate placeholder spritesheets for the two generic sprites"
```

---

### Task 6: Wire Player to Sprite + AnimationController

**Files:**
- Modify: `frontend/src/game/entities/Player.ts` (full file, 56 lines)

**Interfaces:**
- Consumes: `SpriteManifest` (Task 1), `resolveClip` (Task 3), `AnimationController` (Task 4).
- Produces: `Player`'s constructor gains a required 5th parameter `manifest: SpriteManifest`; `Player.sprite` is now `Phaser.GameObjects.Sprite` (was `Arc`); `Player` gains `public animationController: AnimationController` — consumed by `DungeonScene.ts` (Task 10).

No new test file - `Player` isn't unit-tested today (no `Player.test.ts` exists); verified manually in Task 11.

- [ ] **Step 1: Replace the full contents of `frontend/src/game/entities/Player.ts`**

```ts
import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";
import { Weapon } from "../combat/Weapon";
import Health from "../combat/Health";
import { CombatEntity } from "../combat/CombatEntity";
import { SpriteManifest } from "../animation/SpriteManifest";
import { resolveClip } from "../animation/resolveAnimation";
import AnimationController from "../animation/AnimationController";

// Player movement modeled on the "05-physics" example from
// https://github.com/mikewesthad/phaser-3-tilemap-blog-posts (post-1): arcade physics body,
// 4-directional cursor input, velocity normalized so diagonal movement isn't faster.
const PLAYER_SPEED = 350;
const PLAYER_MAX_HP = 100;

export default class Player implements CombatEntity {
  public sprite: Phaser.GameObjects.Sprite;
  public statusEffects: StatusEffectController = new StatusEffectController();
  public health: Health = new Health(PLAYER_MAX_HP);
  public weapon: Weapon;
  public animationController: AnimationController;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  // Live world position, so the player can be passed anywhere a CombatEntity
  // is wanted without wrapping it in an adapter object.
  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  constructor(scene: Phaser.Scene, x: number, y: number, weapon: Weapon, manifest: SpriteManifest) {
    this.weapon = weapon;
    const idleClip = resolveClip(manifest, "idle");
    this.sprite = scene.add.sprite(x, y, idleClip.textureKey);
    scene.physics.add.existing(this.sprite);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.animationController = new AnimationController(scene, this.sprite, manifest);

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

    const isMoving = body.velocity.x !== 0 || body.velocity.y !== 0;
    this.animationController.update(this.health.getRatio(), this.health.isDead, isMoving);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `DungeonScene.ts` (still constructing `Player` with the old 4-arg signature) and `Enemy.ts` (unrelated, not yet touched) - both fixed by Tasks 7 and 10. No errors reported *within* `Player.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/entities/Player.ts
git commit -m "Player: replace placeholder circle with Sprite + AnimationController"
```

---

### Task 7: Wire Enemy to Sprite + AnimationController

**Files:**
- Modify: `frontend/src/game/entities/Enemy.ts` (full file, 35 lines)

**Interfaces:**
- Consumes: `SpriteManifest` (Task 1), `resolveClip` (Task 3), `AnimationController` (Task 4).
- Produces: `Enemy`'s constructor gains a required 7th parameter `manifest: SpriteManifest`; `Enemy.sprite` is now `Phaser.GameObjects.Sprite` (was `Arc`); `Enemy` gains `public animationController: AnimationController` — consumed by `DungeonScene.ts` (Task 10).

No new test file - same rationale as Task 6.

- [ ] **Step 1: Replace the full contents of `frontend/src/game/entities/Enemy.ts`**

```ts
import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";
import Health from "../combat/Health";
import { AggressiveCombatEntity } from "../combat/CombatEntity";
import { hexToNumber } from "@/lib/color";
import { SpriteManifest } from "../animation/SpriteManifest";
import { resolveClip } from "../animation/resolveAnimation";
import AnimationController from "../animation/AnimationController";

// Static placeholder enemy - no movement/AI, matching Player's lack of real pathing. Exists
// mainly to prove the nameplate and combat systems work on a non-player entity; real enemy
// movement/AI is a separate feature.
export default class Enemy implements AggressiveCombatEntity {
  public sprite: Phaser.GameObjects.Sprite;
  public statusEffects: StatusEffectController = new StatusEffectController();
  public health: Health;
  public aggressionLevel: number;
  public animationController: AnimationController;

  // Live world position, so the enemy can be passed anywhere a CombatEntity
  // is wanted without wrapping it in an adapter object.
  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    color: string,
    aggressionLevel: number,
    maxHp: number,
    manifest: SpriteManifest
  ) {
    const idleClip = resolveClip(manifest, "idle");
    this.sprite = scene.add.sprite(x, y, idleClip.textureKey);
    this.sprite.setTint(hexToNumber(color));
    this.aggressionLevel = aggressionLevel;
    this.health = new Health(maxHp);
    this.animationController = new AnimationController(scene, this.sprite, manifest);
  }

  update(deltaMs: number) {
    this.statusEffects.update(deltaMs);
    // No movement yet, so isMoving is always false - see the class comment above.
    this.animationController.update(this.health.getRatio(), this.health.isDead, false);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `DungeonScene.ts` (still constructing `Enemy` with the old 6-arg signature) - fixed by Task 10.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/entities/Enemy.ts
git commit -m "Enemy: replace placeholder circle with Sprite + AnimationController"
```

---

### Task 8: PlayerCombat gains an onAttack callback

**Files:**
- Modify: `frontend/src/game/combat/PlayerCombat.ts:37-91` (the `PlayerCombat` class; `PhaserAttackInput` below it is unchanged)
- Test: `frontend/tests/game/combat/PlayerCombat.test.ts`

**Interfaces:**
- Produces: `PlayerCombat`'s constructor gains an optional 6th parameter `options?: { onAttack?: (attackId: string) => void }` — consumed by `DungeonScene.ts` (Task 10). Existing 5-arg call sites remain valid (this param is optional).

- [ ] **Step 1: Write the failing tests**

Add to the end of `frontend/tests/game/combat/PlayerCombat.test.ts` (before the final closing nothing - i.e. as a new top-level `describe` block after the existing `"PlayerCombat damage"` block):

```ts
describe("PlayerCombat onAttack callback", () => {
  it("calls onAttack with the basic attack's id when the basic attack lands", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    const input = makeInput({ isBasicAttackJustPressed: () => true });
    const onAttack = vi.fn();
    const combat = new PlayerCombat(makeWeapon(), self, () => [enemy], OPEN_BLOCKER, input, { onAttack });

    combat.update(0);

    expect(onAttack).toHaveBeenCalledWith("basic_attack");
  });

  it("does not call onAttack when the basic attack whiffs (no qualifying enemy)", () => {
    const self = makeEntity();
    const farEnemy = makeEntity(1000, 0);
    const input = makeInput({ isBasicAttackJustPressed: () => true });
    const onAttack = vi.fn();
    const combat = new PlayerCombat(makeWeapon(), self, () => [farEnemy], OPEN_BLOCKER, input, { onAttack });

    combat.update(0);

    expect(onAttack).not.toHaveBeenCalled();
  });

  it("calls onAttack with the ability's id when a target-requiring ability fires", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    const input = makeInput({ isAbilityJustPressed: (slot) => slot === 0 });
    const weapon = makeWeapon({ attackIds: ["puncture"] });
    const onAttack = vi.fn();
    const combat = new PlayerCombat(weapon, self, () => [enemy], OPEN_BLOCKER, input, { onAttack });

    combat.update(0);

    expect(onAttack).toHaveBeenCalledWith("puncture");
  });

  it("calls onAttack for a self-only ability even with no enemy present", () => {
    const self = makeEntity();
    const input = makeInput({ isAbilityJustPressed: (slot) => slot === 0 });
    const weapon = makeWeapon({ attackIds: ["battle_focus"] });
    const onAttack = vi.fn();
    const combat = new PlayerCombat(weapon, self, () => [], OPEN_BLOCKER, input, { onAttack });

    combat.update(0);

    expect(onAttack).toHaveBeenCalledWith("battle_focus");
  });

  it("does not call onAttack when a target-requiring ability has no enemy in range", () => {
    const self = makeEntity();
    const farEnemy = makeEntity(1000, 0);
    const input = makeInput({ isAbilityJustPressed: (slot) => slot === 0 });
    const weapon = makeWeapon({ attackIds: ["puncture"] });
    const onAttack = vi.fn();
    const combat = new PlayerCombat(weapon, self, () => [farEnemy], OPEN_BLOCKER, input, { onAttack });

    combat.update(0);

    expect(onAttack).not.toHaveBeenCalled();
  });

  it("works with no onAttack option provided at all", () => {
    const self = makeEntity();
    const enemy = makeEntity(10, 0);
    const input = makeInput({ isBasicAttackJustPressed: () => true });
    const combat = new PlayerCombat(makeWeapon(), self, () => [enemy], OPEN_BLOCKER, input);

    expect(() => combat.update(0)).not.toThrow();
  });
});
```

Also change the test file's import line to pull in `vi`:

```ts
import { describe, it, expect, vi } from "vitest";
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run tests/game/combat/PlayerCombat.test.ts`
Expected: FAIL - `onAttack` is called 0 times in every new test (the option doesn't exist on `PlayerCombat` yet, so TypeScript will actually fail to compile the test file first; that compile failure is the expected "fail" here).

- [ ] **Step 3: Implement**

In `frontend/src/game/combat/PlayerCombat.ts`, change the constructor and the two private methods:

```ts
export default class PlayerCombat {
  // Holds the basic attack (keyed by BASIC_ATTACK.id, gated by the weapon's
  // attack speed) alongside ability cooldowns; the id pools don't overlap.
  private cooldowns = new CooldownTracker();

  constructor(
    private weapon: Weapon,
    private self: CombatEntity,
    private getEnemies: () => CombatEntity[],
    private blocker: LineOfSightBlocker,
    private input: AttackInput,
    private options: { onAttack?: (attackId: string) => void } = {}
  ) {}

  update(deltaMs: number): void {
    this.cooldowns.tick(deltaMs);

    if (this.input.isBasicAttackJustPressed()) this.tryBasicAttack();
    for (const slot of [0, 1, 2] as const) {
      if (this.input.isAbilityJustPressed(slot)) this.tryAbility(slot);
    }
  }

  private tryBasicAttack(): void {
    if (!this.cooldowns.isReady(BASIC_ATTACK.id)) return;
    this.cooldowns.start(BASIC_ATTACK.id, this.weapon.attackSpeedMs);

    const target = findNearestTarget(
      this.self,
      this.getEnemies(),
      this.weapon.rangeTiles * TILE_SIZE,
      this.blocker
    );
    if (!target) return;
    resolveAttackComponents(BASIC_ATTACK.effects, this.self, target, this.weapon.damage);
    this.options.onAttack?.(BASIC_ATTACK.id);
  }

  private tryAbility(slot: 0 | 1 | 2): void {
    const attackId = this.weapon.attackIds[slot];
    if (!attackId) return;
    if (!this.cooldowns.isReady(attackId)) return;

    const definition = WEAPON_ATTACKS.find((a) => a.id === attackId);
    if (!definition) return;

    this.cooldowns.start(attackId, definition.cooldownMs);

    const requiresTarget = definition.effects.some((component) => component.target === "target");
    const target = requiresTarget
      ? findNearestTarget(this.self, this.getEnemies(), this.weapon.rangeTiles * TILE_SIZE, this.blocker)
      : null;
    if (requiresTarget && !target) return;

    resolveAttackComponents(definition.effects, this.self, target, this.weapon.damage);
    this.options.onAttack?.(attackId);
  }
}
```

(The `AttackInput` interface, `findNearestTarget`, and `PhaserAttackInput` below this class are unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/combat/PlayerCombat.test.ts`
Expected: PASS (all tests, including the 6 new ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/PlayerCombat.ts frontend/tests/game/combat/PlayerCombat.test.ts
git commit -m "PlayerCombat: add optional onAttack callback for animation triggering"
```

---

### Task 9: EnemyCombat gains an onAttack callback

**Files:**
- Modify: `frontend/src/game/combat/EnemyCombat.ts` (full file, 83 lines)
- Test: `frontend/tests/game/combat/EnemyCombat.test.ts`

**Interfaces:**
- Produces: `EnemyCombat`'s constructor `options` parameter gains `onAttack?: (attackId: string) => void` alongside the existing `trigger`/`selector` — consumed by `DungeonScene.ts` (Task 10).

- [ ] **Step 1: Write the failing tests**

Add to the end of `frontend/tests/game/combat/EnemyCombat.test.ts`, inside the existing `describe("EnemyCombat", ...)` block (as new `it`s alongside the others):

```ts
  it("calls onAttack with the chosen attack's id when an attack resolves", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const onAttack = vi.fn();
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, {
      selector: (_enemy, available) => available.find((a) => a.id === "brace") ?? null,
      onAttack,
    });
    combat.update(1500);
    expect(onAttack).toHaveBeenCalledWith("brace");
  });

  it("does not call onAttack when the selector returns null", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const onAttack = vi.fn();
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, { selector: () => null, onAttack });
    combat.update(1500);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it("works with no onAttack option provided at all", () => {
    const enemy = makeEntity(3);
    const player: CombatEntity = makeEntity(0);
    const combat = new EnemyCombat(enemy, () => player, OPEN_BLOCKER, {
      selector: (_enemy, available) => available.find((a) => a.id === "brace") ?? null,
    });
    expect(() => combat.update(1500)).not.toThrow();
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run tests/game/combat/EnemyCombat.test.ts`
Expected: FAIL - `onAttack` doesn't exist on the options type yet (TypeScript compile failure).

- [ ] **Step 3: Implement**

Replace the full contents of `frontend/src/game/combat/EnemyCombat.ts`:

```ts
import { ATTACKS, AttackDefinition } from "./EnemyAttack";
import { CombatEntity, AggressiveCombatEntity } from "./CombatEntity";
import { resolveAttackComponents } from "./AttackComponent";
import CooldownTracker from "./CooldownTracker";
import { LineOfSightBlocker, isWithinRange, hasLineOfSight } from "./lineOfSight";
import { TILE_SIZE } from "../constants";

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
  isReady: (attackId: string) => boolean
): AttackDefinition[] {
  return ATTACKS.filter((attack) => attack.minAggression <= aggressionLevel && isReady(attack.id));
}

const defaultTrigger: AttackTrigger = (_enemy, _target, timeSinceLastAttempt) =>
  timeSinceLastAttempt >= DEFAULT_ATTACK_ATTEMPT_INTERVAL_MS;

const defaultSelector: AttackSelector = (_enemy, available) =>
  available.length === 0 ? null : available[Math.floor(Math.random() * available.length)];

export default class EnemyCombat {
  private cooldowns = new CooldownTracker();
  private timeSinceLastAttempt = 0;
  private trigger: AttackTrigger;
  private selector: AttackSelector;
  private onAttack?: (attackId: string) => void;

  constructor(
    private enemy: AggressiveCombatEntity,
    private getTarget: () => CombatEntity,
    private blocker: LineOfSightBlocker,
    options?: { trigger?: AttackTrigger; selector?: AttackSelector; onAttack?: (attackId: string) => void }
  ) {
    this.trigger = options?.trigger ?? defaultTrigger;
    this.selector = options?.selector ?? defaultSelector;
    this.onAttack = options?.onAttack;
  }

  update(deltaMs: number): void {
    this.cooldowns.tick(deltaMs);
    this.timeSinceLastAttempt += deltaMs;

    const target = this.getTarget();
    if (!this.trigger(this.enemy, target, this.timeSinceLastAttempt)) return;
    this.timeSinceLastAttempt = 0;

    const byAggressionAndCooldown = getAvailableAttacks(this.enemy.aggressionLevel, (id) =>
      this.cooldowns.isReady(id)
    );
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

    this.cooldowns.start(chosen.id, chosen.cooldownMs);
    resolveAttackComponents(chosen.effects, this.enemy, target, 0);
    this.onAttack?.(chosen.id);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/combat/EnemyCombat.test.ts`
Expected: PASS (all tests, including the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/combat/EnemyCombat.ts frontend/tests/game/combat/EnemyCombat.test.ts
git commit -m "EnemyCombat: add optional onAttack callback for animation triggering"
```

---

### Task 10: Wire DungeonScene to resolve manifests, load textures, and construct animated entities

**Files:**
- Modify: `frontend/src/game/scenes/DungeonScene.ts` (full file, ~275 lines after this change)

**Interfaces:**
- Consumes: everything from Tasks 1-9.
- Produces: `DungeonScene.create()` is now `async`; `update()` gains a guard for the async gap.

No new test file - `DungeonScene` isn't unit-tested (it's a Phaser scene factory); verified manually in Task 11.

- [ ] **Step 1: Replace the full contents of `frontend/src/game/scenes/DungeonScene.ts`**

```ts
import type Phaser from "phaser";
import Dungeon from "@mikewesthad/dungeon";
import { TILE_SIZE } from "../constants";
import Player from "../entities/Player";
import Enemy from "../entities/Enemy";
import { generateWeapon, randomWeaponCategory } from "../combat/Weapon";
import TILE_MAPPING from "../tileMapping";
import { GameConfig } from "@/types/game";
import { getMoodTint } from "@/lib/moodTint";
import { addVignette } from "../effects/vignette";
import { addConfetti } from "../effects/confetti";
import { addRain, followCamera as rainFollowCamera } from "../effects/rain";
import EntityLabel from "../ui/EntityLabel";
import { loadSettings, subscribeSettings } from "../settings";
import { getDisplayName } from "@/lib/auth";
import EnemyCombat from "../combat/EnemyCombat";
import PlayerCombat, { PhaserAttackInput } from "../combat/PlayerCombat";
import { LineOfSightBlocker } from "../combat/lineOfSight";
import { prettifyName } from "@/lib/format";
import { ClipDef, SpriteManifest } from "../animation/SpriteManifest";
import { SpriteProvider, LocalSpriteProvider, GENERIC_HUMANOID_MANIFEST, GENERIC_ENEMY_MANIFEST } from "../animation/SpriteProvider";
import { pickManifest } from "../animation/resolveAnimation";

// Room count scales length_of_day (Min: 5, Max: 10)
function getRoomCount(lengthOfDay: number): number {
  if (!Number.isFinite(lengthOfDay)) return 5;
  return Math.round(Math.min(10, Math.max(5, lengthOfDay)));
}

// Paints every generated room onto the ground layer: floor, corners, walls,
// and door openings punched through at the room's connection points.
function paintRooms(groundLayer: Phaser.Tilemaps.TilemapLayer, dungeon: Dungeon) {
  dungeon.rooms.forEach((room) => {
    const { x, y, width, height, left, right, top, bottom } = room;

    // Floor: mostly clean tiles, occasionally a dirty one
    groundLayer.weightedRandomize(TILE_MAPPING.FLOOR, x, y, width, height);

    // Room corners
    groundLayer.putTileAt(TILE_MAPPING.WALL.TOP_LEFT, left, top);
    groundLayer.putTileAt(TILE_MAPPING.WALL.TOP_RIGHT, right, top);
    groundLayer.putTileAt(TILE_MAPPING.WALL.BOTTOM_RIGHT, right, bottom);
    groundLayer.putTileAt(TILE_MAPPING.WALL.BOTTOM_LEFT, left, bottom);

    // Walls: mostly clean tiles, occasionally a dirty one
    groundLayer.weightedRandomize(TILE_MAPPING.WALL.TOP, left + 1, top, width - 2, 1);
    groundLayer.weightedRandomize(TILE_MAPPING.WALL.BOTTOM, left + 1, bottom, width - 2, 1);
    groundLayer.weightedRandomize(TILE_MAPPING.WALL.LEFT, left, top + 1, 1, height - 2);
    groundLayer.weightedRandomize(TILE_MAPPING.WALL.RIGHT, right, top + 1, 1, height - 2);

    // Doors punch through the wall at the room's connection points to its neighbors
    for (const door of room.getDoorLocations()) {
      if (door.y === 0) {
        groundLayer.putTilesAt(TILE_MAPPING.DOOR.TOP, x + door.x - 1, y + door.y);
      } else if (door.y === room.height - 1) {
        groundLayer.putTilesAt(TILE_MAPPING.DOOR.BOTTOM, x + door.x - 1, y + door.y);
      } else if (door.x === 0) {
        groundLayer.putTilesAt(TILE_MAPPING.DOOR.LEFT, x + door.x, y + door.y - 1);
      } else if (door.x === room.width - 1) {
        groundLayer.putTilesAt(TILE_MAPPING.DOOR.RIGHT, x + door.x, y + door.y - 1);
      }
    }
  });
}

const MANIFEST_FETCH_TIMEOUT_MS = 5000;

// Never lets a slow/hanging SpriteProvider block dungeon creation - a timed-out fetch is treated
// the same as "sprite id not found" (see pickManifest).
function fetchManifestWithTimeout(provider: SpriteProvider, spriteId: string): Promise<SpriteManifest | null> {
  return Promise.race([
    provider.getManifest(spriteId).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), MANIFEST_FETCH_TIMEOUT_MS)),
  ]);
}

function queueManifestTextures(scene: Phaser.Scene, manifest: SpriteManifest, queued: Set<string>) {
  (Object.values(manifest.clips) as ClipDef[]).forEach((clip) => {
    if (queued.has(clip.textureKey) || scene.textures.exists(clip.textureKey)) return;
    queued.add(clip.textureKey);
    scene.load.spritesheet(clip.textureKey, clip.textureUrl, { frameWidth: clip.frameWidth, frameHeight: clip.frameHeight });
  });
}

function manifestHasFailedTexture(manifest: SpriteManifest, failedKeys: Set<string>): boolean {
  return (Object.values(manifest.clips) as ClipDef[]).some((clip) => failedKeys.has(clip.textureKey));
}

interface EnemyInstance {
  enemy: Enemy;
  combat: EnemyCombat;
  label: EntityLabel;
}

export function createDungeonScene(PhaserLib: typeof Phaser, config: GameConfig, fontFamily: string) {
  return class DungeonScene extends PhaserLib.Scene {
    private player!: Player;
    private playerLabel!: EntityLabel;
    private enemyInstances: EnemyInstance[] = [];
    private playerCombat!: PlayerCombat;
    private isPlayerDead = false;
    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private stuffLayer!: Phaser.Tilemaps.TilemapLayer;
    private moodOverlay!: Phaser.GameObjects.Rectangle;
    private vignette?: Phaser.GameObjects.Image;
    private rainSpawnZone?: { x: number; y: number; width: number; height: number; getRandomPoint(p: { x: number; y: number }): void };

    constructor() {
      super("DungeonScene");
    }

    preload() {
      this.load.image("tiles", "/tilesets/buch-tileset-48px.png");
    }

    // Resolves the player/enemy sprite manifests (falling back to the generic manifests on fetch
    // failure, unknown id, or a texture actually failing to download) and loads every clip's
    // texture before returning, so by the time this resolves everything needed to build
    // Player/Enemy's AnimationControllers is already in the texture manager.
    private async loadEntityManifests(spriteProvider: SpriteProvider): Promise<{ player: SpriteManifest; enemy: SpriteManifest }> {
      const [playerFetched, enemyFetched] = await Promise.all([
        fetchManifestWithTimeout(spriteProvider, config.player_sprite),
        fetchManifestWithTimeout(spriteProvider, config.enemy_type),
      ]);

      let playerManifest = pickManifest("player", playerFetched);
      let enemyManifest = pickManifest("enemy", enemyFetched);

      const failedKeys = new Set<string>();
      this.load.on(PhaserLib.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => failedKeys.add(file.key));

      const queued = new Set<string>();
      // Always queue the generic manifests too, so there's a guaranteed-loaded fallback even if
      // a fetched manifest's own texture URLs 404 after the fetch itself succeeded.
      queueManifestTextures(this, GENERIC_HUMANOID_MANIFEST, queued);
      queueManifestTextures(this, GENERIC_ENEMY_MANIFEST, queued);
      queueManifestTextures(this, playerManifest, queued);
      queueManifestTextures(this, enemyManifest, queued);

      await new Promise<void>((resolve) => {
        this.load.once(PhaserLib.Loader.Events.COMPLETE, () => resolve());
        this.load.start();
      });

      if (manifestHasFailedTexture(playerManifest, failedKeys)) playerManifest = GENERIC_HUMANOID_MANIFEST;
      if (manifestHasFailedTexture(enemyManifest, failedKeys)) enemyManifest = GENERIC_ENEMY_MANIFEST;

      return { player: playerManifest, enemy: enemyManifest };
    }

    async create() {
      const dungeon = new Dungeon({
        width: 50,
        height: 50,
        doorPadding: 2,
        rooms: {
          width: { min: 7, max: 15, onlyOdd: true },
          height: { min: 7, max: 15, onlyOdd: true },
          maxRooms: getRoomCount(config.length_of_day),
        },
      });

      // Create a blank map matching the dungeon's dimensions
      const map = this.make.tilemap({
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
        width: dungeon.width,
        height: dungeon.height,
      });

      const tileset = map.addTilesetImage("tiles", undefined, TILE_SIZE, TILE_SIZE, 0, 0)!;
      this.groundLayer = map.createBlankLayer("Ground", tileset)!;
      // Second layer for items/decorations
      this.stuffLayer = map.createBlankLayer("Stuff", tileset)!;

      paintRooms(this.groundLayer, dungeon);

      // Everything except empty tiles and floor variants should block movement
      // hard-coded and needs changing when more tilemaps are added
      this.groundLayer.setCollisionByExclusion([-1, 6, 7, 8, 26]);
      this.stuffLayer.setCollisionByExclusion([-1, 6, 7, 8, 26]);

      this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

      const spriteProvider = new LocalSpriteProvider();
      const { player: playerManifest, enemy: enemyManifest } = await this.loadEntityManifests(spriteProvider);

      const startRoom = dungeon.rooms[0];
      const playerX = map.tileToWorldX(startRoom.centerX)!;
      const playerY = map.tileToWorldY(startRoom.centerY)!;
      const weapon = generateWeapon(randomWeaponCategory());
      this.player = new Player(this, playerX, playerY, weapon, playerManifest);
      this.cameras.main.startFollow(this.player.sprite, true);

      this.physics.add.collider(this.player.sprite, this.groundLayer);
      this.physics.add.collider(this.player.sprite, this.stuffLayer);

      // Static demo enemy: a second room if the dungeon generated one, otherwise a point offset
      // from the player's spawn within the same room so the two don't overlap.
      const enemyRoom = dungeon.rooms[1] ?? startRoom;
      const enemyTileX = dungeon.rooms[1] ? enemyRoom.centerX : Math.min(enemyRoom.right - 1, enemyRoom.centerX + 2);
      const enemyTileY = dungeon.rooms[1] ? enemyRoom.centerY : Math.min(enemyRoom.bottom - 1, enemyRoom.centerY + 2);
      const enemyX = map.tileToWorldX(enemyTileX)!;
      const enemyY = map.tileToWorldY(enemyTileY)!;
      // Aggression 3 so the demo reaches all three example attacks (see combat/EnemyAttack.ts) over time.
      const enemy = new Enemy(this, enemyX, enemyY, config.enemy_color, 3, 50, enemyManifest);

      this.playerLabel = new EntityLabel(this, fontFamily, this.player.sprite, {
        name: getDisplayName() ?? "You",
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      });
      this.playerLabel.setNameVisible(loadSettings().showPlayerName);
      const unsubscribeSettings = subscribeSettings((settings) => {
        this.playerLabel.setNameVisible(settings.showPlayerName);
      });
      this.events.once(PhaserLib.Scenes.Events.SHUTDOWN, unsubscribeSettings);
      this.events.once(PhaserLib.Scenes.Events.DESTROY, unsubscribeSettings);

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
      // Player and Enemy implement CombatEntity themselves (live x/y getters),
      // so both combat systems take the entities directly.
      const enemyCombat = new EnemyCombat(enemy, () => this.player, blocker, {
        onAttack: (attackId) => enemy.animationController.play("attack", { abilityId: attackId }),
      });
      this.enemyInstances = [{ enemy, combat: enemyCombat, label: enemyLabel }];

      this.playerCombat = new PlayerCombat(
        this.player.weapon,
        this.player,
        () => this.enemyInstances.map(({ enemy }) => enemy),
        blocker,
        new PhaserAttackInput(this),
        { onAttack: (attackId) => this.player.animationController.play("attack", { abilityId: attackId }) }
      );

      // Full-screen mood tint over the whole level, so the run feels different depending on
      // whether the journal entry read as a good day or a bad one (see src/lib/moodTint.ts).
      const tint = getMoodTint(config.mood);
      this.moodOverlay = this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, tint.color, tint.alpha)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setBlendMode(tint.blendMode);
      this.scale.on(PhaserLib.Scale.Events.RESIZE, (gameSize: { width: number; height: number }) => {
        this.moodOverlay.setSize(gameSize.width, gameSize.height);
        this.vignette?.setDisplaySize(gameSize.width, gameSize.height);
      });

      // Extra colored vignette for moods that call for one, layered above the mood tint
      if (tint.vignette) {
        this.vignette = addVignette(this, this.scale.width, this.scale.height, tint.vignette);
      }

      // Falling confetti for happy days, currently disabled.
      if (tint.confetti) {
        addConfetti(this, this.scale.width);
      }

      // Light rain for reflective days, world-space so it scrolls with the tiles (see rain.ts)
      if (tint.rain) {
        this.rainSpawnZone = addRain(this).spawnZone;
      }

      this.add
        .text(100, 10, `${dungeon.rooms.length} rooms generated`, {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#e2e8f0",
          backgroundColor: "#0f172a",
          padding: { x: 6, y: 4 },
        })
        .setScrollFactor(0);
    }

    update(time: number, delta: number) {
      // create() resolves sprite manifests asynchronously; guard against Phaser calling update()
      // on an earlier frame before it has finished.
      if (!this.player) return;
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
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, all suites (this task touches no test files, but confirms the DungeonScene changes didn't break anything the suite covers).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/game/scenes/DungeonScene.ts
git commit -m "DungeonScene: resolve sprite manifests, load textures, wire onAttack callbacks"
```

---

### Task 11: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated check**

Run (from `frontend/`): `npx tsc --noEmit && npx vitest run`
Expected: both pass cleanly.

- [ ] **Step 2: Launch the app and drive the play flow**

Use the `frontend:verify` skill (or, if unavailable, `npm run dev` and open the app manually) to reach `/play` with the mock config (`player_sprite: "programmer"`, `enemy_type: "bug"`).

- [ ] **Step 3: Confirm the sparse-manifest path**

`"programmer"`/`"bug"` (Task 2's `LocalSpriteProvider` entries) only define idle/walk/death. Confirm:
- The player and enemy render as animated sprites, not circles or blank/missing textures.
- Standing still shows the idle animation cycling; moving the player (arrow keys/WASD) switches to the walk animation.
- Pressing SPACE (basic attack) or Q/W/E (abilities) near the enemy does **not** error and does **not** freeze the player sprite on a missing texture - since `"programmer"` has no `attack` clip, this should visibly fall back to continuing the walk/idle animation (per `resolveClip`'s fallback), while damage/status effects still apply normally (unaffected by the animation fallback).
- When the enemy's or player's health reaches 0, the death animation plays and the entity is removed/the "YOU DIED" text appears, same as before this change.

- [ ] **Step 4: Confirm the unknown-sprite fallback path**

Temporarily edit `frontend/src/lib/mockGameConfig.ts`'s `player_sprite` to something not in `LocalSpriteProvider` (e.g. `"totally_unknown_sprite_xyz"`), reload `/play` via "Preview with mock data", and confirm the player renders using the `generic_humanoid` placeholder sprite (blue-tinted frames) instead of erroring or showing a blank texture. Revert the temporary edit afterward (`git checkout -- frontend/src/lib/mockGameConfig.ts` or manually restore `"programmer"`) - do not commit this change.

- [ ] **Step 5: Report results**

No commit for this task. Report back: automated check results, and pass/fail for each of the manual checks in Steps 3-4. If anything fails, treat it as a bug to fix (new task) before considering the plan complete - do not mark this step done with a failing check.
