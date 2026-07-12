# Sprite Animation System — Design

## Goal

Replace the current placeholder rendering (`Player`/`Enemy` are plain colored `Phaser.GameObjects.Arc`
circles) with a sprite-and-animation system that can drive idle/walk/attack/hit/death states for
any entity, where:

- The set of sprites is expected to grow large and open-ended — `GameConfig.player_sprite` and
  `GameConfig.enemy_type` are freeform strings chosen by Gemini per journal entry (e.g.
  `"programmer"`, `"bug"`), not a fixed enum.
- Individual sprites may define only some animation states (some may have no dedicated attack
  pose, none currently have a dash pose, etc.) — the system must degrade gracefully, not require
  every sprite to be complete.
- Sprite art (spritesheets + metadata about which states each sprite has) is expected to live in
  a database and be fetched/downloaded only once a journal entry has decided which sprites are
  actually needed for that run — not preloaded wholesale. That database/storage layer is being
  built separately; this spec defines the interface this system consumes from it and ships with a
  local mock implementation so the rest of the system can be built and tested without it existing
  yet.

## Scope

- A sparse, per-sprite animation manifest shape and a pure resolver that picks the best available
  clip for a requested state, including two fallback rules:
  - a sprite missing one specific state's clip falls back to that entity's current idle/walk
    animation (game logic is unaffected either way — this is purely visual).
  - a sprite id with no manifest at all (fetch failed, or the id is unrecognized) falls back to
    one of two fully-populated generic manifests (`generic_humanoid`, `generic_enemy`).
- A `SpriteProvider` interface for fetching a manifest by sprite id, plus a `LocalSpriteProvider`
  mock implementation (a couple of hardcoded manifests, matching `mockGameConfig`'s
  `"programmer"`/`"bug"`) for development and tests. The real DB-backed provider is out of scope
  here and is a drop-in replacement later.
- A Phaser-facing `AnimationController`, owned by `Player`/`Enemy`, that registers a resolved
  manifest's clips as Phaser animations and exposes `play(state)`, with interrupt/priority rules
  (death latches; hit is brief and non-interrupting of death; attack blocks idle/walk swaps until
  it completes).
- Wiring `Player`/`Enemy` from `Arc` to `Sprite` + `AnimationController`, and `DungeonScene`
  resolving both entities' manifests (with fallback) before construction.
- Placeholder spritesheet assets for the two generic manifests, so the full pipeline is exercised
  end-to-end today.
- A reserved `"dash"` animation state in the manifest shape only — no gameplay mechanic, no
  trigger anywhere in code. (Dash-the-ability — trigger, cooldown, movement, possible i-frames —
  is a separate follow-up spec once this system exists to hang it on.)

Out of scope: the sprite database/storage layer itself (schema, upload pipeline, LLM sprite
selection) — being built separately. The dash gameplay mechanic. Per-ability attack animations
being mandatory (supported by the manifest shape via `` `attack:${abilityId}` `` keys, but no
sprite is required to define them — falls back to the generic `"attack"` clip). Real (non-
placeholder) art.

## Data model

### `src/game/animation/SpriteManifest.ts`

```ts
export type AnimationState = "idle" | "walk" | "dash" | "attack" | "hit" | "death";

// Attacks can optionally get their own clip, keyed by ability id (e.g. "attack:puncture").
// Falls back to the plain "attack" clip if a sprite doesn't define one for a given ability.
export type ManifestKey = AnimationState | `attack:${string}`;

export interface ClipDef {
  textureKey: string;   // unique per spriteId+state, used as the Phaser texture/animation key
  textureUrl: string;   // where to download the spritesheet from
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameRate: number;
  repeat: number;        // -1 for looping (idle/walk/dash), 0 for one-shot (attack/hit/death)
}

export interface SpriteManifest {
  spriteId: string;
  clips: Partial<Record<ManifestKey, ClipDef>>;
}
```

### `src/game/animation/SpriteProvider.ts`

```ts
export interface SpriteProvider {
  getManifest(spriteId: string): Promise<SpriteManifest | null>;
}

// Fully populated (all six AnimationStates) — the only manifests required to be complete.
// Each of the six states maps to a ClipDef pointing at that sprite's placeholder spritesheet,
// e.g.:
//   idle: { textureKey: "generic_humanoid_idle", textureUrl: "/sprites/generic_humanoid_idle.png",
//           frameWidth: 32, frameHeight: 32, frameCount: 4, frameRate: 6, repeat: -1 }
export const GENERIC_HUMANOID_MANIFEST: SpriteManifest = { spriteId: "generic_humanoid", clips: { idle, walk, dash, attack, hit, death } };
export const GENERIC_ENEMY_MANIFEST: SpriteManifest = { spriteId: "generic_enemy", clips: { idle, walk, dash, attack, hit, death } };

// Dev/test implementation. The real DB-backed provider implements the same interface later.
export class LocalSpriteProvider implements SpriteProvider {
  async getManifest(spriteId: string): Promise<SpriteManifest | null>;
}
```

### `src/game/animation/resolveAnimation.ts` (pure, unit-tested directly)

```ts
// Swaps in the correct generic manifest when fetch failed or returned null.
export function pickManifest(spriteKind: "player" | "enemy", fetched: SpriteManifest | null): SpriteManifest;

// Missing-state fallback chain: exact match -> "walk" -> "idle". Generic manifests guarantee
// idle/walk exist, so this always resolves.
export function resolveClip(manifest: SpriteManifest, requested: ManifestKey): ClipDef;

// Priority table: death > attack > hit > walk/idle/dash. death latches (nothing interrupts it);
// hit doesn't interrupt an in-progress attack (matches the Data flow section below), but a new
// attack does interrupt a brief hit-react. Returns whether `requested` should override `current`.
export function shouldInterrupt(current: AnimationState, requested: AnimationState): boolean;
```

## `AnimationController` (`src/game/animation/AnimationController.ts`)

Phaser-facing, owned by `Player`/`Enemy` the same way they already own `sprite` — not unit-tested
directly (thin glue over the pure functions above), same split as `EntityLabel`/`diffBadgeIds`.

```ts
export default class AnimationController {
  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, manifest: SpriteManifest);
  play(state: AnimationState, options?: { abilityId?: string }): void;
  update(healthRatio: number, isDead: boolean, isMoving: boolean): void;
}
```

- On construction, registers every clip present in the manifest as a Phaser animation
  (`scene.anims.create`, keyed by each `ClipDef.textureKey` so multiple entities sharing a
  manifest don't collide).
- `play(state, { abilityId })`: resolves the manifest key (`` `attack:${abilityId}` `` first if
  given, else the plain state) via `resolveClip`, checks `shouldInterrupt` against the currently
  playing state, and if allowed calls `sprite.play(clip.textureKey)`. Non-looping clips
  (`repeat: 0`) register a one-time `animationcomplete` listener that returns to `"walk"`/`"idle"`
  (based on the last known `isMoving`) once finished.
- `update(...)` is the polling half — see Data flow below.

## Data flow — how states get triggered

Kept out of the Phaser-free combat modules (`resolveAttackComponents`, `PlayerCombat`,
`EnemyCombat` stay exactly as they are today — no `AnimationController` reference threaded
through them). Two trigger styles, split by whether the moment is representable as continuous
state or a discrete event:

- **Polled** (idle/walk/hit/death) — `AnimationController.update(healthRatio, isDead, isMoving)`,
  called from `Player.update()`/`Enemy.update()` alongside where `statusEffects.update()` already
  runs today; it doesn't need `deltaMs` itself since Phaser's own animation clock handles frame
  timing. Internally compares this frame's `healthRatio`
  against last frame's to detect "just took damage" → `play("hit")`, and `isDead` transitioning
  false→true → `play("death")` (which then latches — `shouldInterrupt` returns false against a
  current state of `"death"` for anything). `isMoving` (velocity ≠ 0, which `Player`/`Enemy`
  already compute) directly maps to `play("walk")`/`play("idle")` when nothing higher-priority is
  playing. This mirrors how `EntityLabel.update()` already polls `health`/`statusEffects` each
  frame rather than being pushed events.
- **Explicit callback** (attack) — a real "attack fired" moment isn't reliably inferable from
  polling (nothing distinguishes "just fired" from "cooldown still ticking" between frames).
  `PlayerCombat` and `EnemyCombat` each gain an optional constructor callback,
  `onAttack?: (attackId: string) => void`, invoked immediately after `resolveAttackComponents`
  runs for an attack that actually resolved (not a failed/blocked attempt) — same shape as
  `EnemyCombat`'s existing `options?: { trigger?, selector? }`. `DungeonScene` wires this to
  `entity.animationController.play("attack", { abilityId: attackId })`.

## Loading integration

`DungeonScene.create()` becomes async:

1. Resolve `config.player_sprite` and `config.enemy_type` to manifests via an injected
   `SpriteProvider` (`getManifest`, with a timeout so a slow/failed fetch can't hang scene
   creation), running each through `pickManifest` to substitute the appropriate generic manifest
   on failure or unknown id.
2. Queue each resolved manifest's `ClipDef.textureUrl`s on `this.load`, using
   `this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, ...)` per key to swap that entity to its
   generic manifest if a specific texture fails to actually download.
3. `this.load.start()` / await completion, then construct `Player`/`Enemy` with their resolved
   manifest, each building its own `AnimationController`.

`Player`/`Enemy` hold `sprite: Phaser.GameObjects.Sprite` (replacing `Arc`) and an
`AnimationController`; `CombatEntity` conformance (live `x`/`y` getters) is unchanged.

## Placeholder assets

`generic_humanoid`/`generic_enemy` ship with simple placeholder spritesheets (solid-color frames,
distinguishable per state) checked into `frontend/public/sprites/`, so the full fetch → load →
animate pipeline runs today without the real sprite database existing yet. Swapping in real art
later — for these two generic sprites or for any newly-added named sprite — is purely a
`SpriteProvider`/manifest content change; no code changes.

## Testing

- `resolveAnimation.test.ts`: `pickManifest` (known vs. failed/unknown → generic), `resolveClip`'s
  fallback chain (exact match, missing-state → walk/idle), `shouldInterrupt`'s priority table
  (death blocks everything, hit doesn't interrupt death, attack blocks walk/idle, walk/idle don't
  interrupt each other's non-priority swaps).
- `LocalSpriteProvider.test.ts`: known id resolves a manifest, unknown id resolves `null`.
- `AnimationController` is not unit-tested directly (thin Phaser glue), consistent with
  `EntityLabel` — verified manually instead.

## Verification

- `npx tsc --noEmit` and `npx vitest run`.
- `frontend:verify`: run the dev server, drive `/play` with a mock config, confirm the player and
  enemy sprites actually animate through idle → walk → attack → hit → death as the corresponding
  triggers fire, and confirm an unrecognized `player_sprite`/`enemy_type` string falls back to the
  generic sprite instead of erroring or staying a blank/missing texture.
