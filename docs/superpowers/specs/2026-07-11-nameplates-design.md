# Nameplates System — Design

## Goal

A basic, reusable nameplate system for the Phaser dungeon scene: a text label that floats above a game entity, showing its name. Must work generically for any entity (player, enemies, future bosses) — not hardcoded to one type.

## Scope

- Generic `NamePlate` class usable on any entity exposing `x`/`y`.
- Wire it onto the existing `Player`.
- Add a minimal static demo `Enemy` entity to prove the system works on a second, non-player entity type.
- Pixel-style font (Silkscreen, via Google Fonts) to match the game's `pixelArt: true` / 16-bit tileset aesthetic.

Out of scope: enemy AI/movement, combat, boss-specific styling tiers, robust font-load synchronization (occasional fallback-font flash on cold load is accepted).

## Architecture

### `src/game/ui/NamePlate.ts` (new)

Generic, decoupled from any specific entity type — depends only on a `{ x: number; y: number }` shape.

```ts
export interface NamePlateTarget {
  x: number;
  y: number;
}

export interface NamePlateOptions {
  offsetY?: number;   // default ~18 — vertical gap above target
  color?: string;      // default "#f8fafc"
  fontSize?: string;   // default "12px"
}

export default class NamePlate {
  constructor(scene: Phaser.Scene, fontFamily: string, target: NamePlateTarget, name: string, options?: NamePlateOptions);
  update(): void;   // re-syncs text position to target.x / target.y each frame
  destroy(): void;
}
```

Text style: `fontFamily` (Silkscreen), `fontSize: "12px"`, `color: "#f8fafc"`, black `stroke` (`strokeThickness: 3`) for legibility over any tile/background. `setOrigin(0.5, 1)` — horizontally centered, bottom-anchored, so plate length doesn't affect vertical position.

### `src/game/entities/Enemy.ts` (new)

Mirrors `Player.ts`'s shape (`sprite: Phaser.GameObjects.Arc`) but static — no `update()` movement logic. Circle filled with `config.enemy_color` (hex string parsed to a Phaser color number), radius 8 (matches Player).

### `DungeonScene.ts` changes

- After player creation, place one `Enemy`: center of `dungeon.rooms[1]` if a second room exists, else a point a few tiles off-center in `dungeon.rooms[0]` (avoids spawning exactly on the player).
- Create two `NamePlate`s:
  - Tracks `player.sprite`, label `"Player"`.
  - Tracks `enemy.sprite`, label from `config.enemy_type`, prettified (underscores → spaces, capitalized — e.g. `"bug"` → `"Bug"`).
- Scene `update()` calls both nameplates' `update()` alongside the existing `player.update()`.

## Font loading

- Add `Silkscreen` next to the existing `Geist`/`Geist_Mono` fonts in `layout.tsx`, via `next/font/google` (same self-hosting mechanism already in use).
- Use the resolved literal font-family string (`silkscreen.style.fontFamily`), not the CSS variable — threaded as a prop: `layout.tsx` → page → `GameComponent` → `createDungeonScene(Phaser, config, fontFamily)` → `NamePlate`.
- No explicit `document.fonts.load()` synchronization. If the font isn't warm yet on first paint, canvas text falls back to a default font until the next redraw — accepted tradeoff for simplicity.

## Verification

- `npx tsc --noEmit` for type safety (repo has no test framework yet).
- Manual check: `npm run dev` → `/` → "Preview with mock data" → `/play`. Confirm both nameplates render, the player's plate tracks it while moving, and text renders in Silkscreen (allowing for a possible brief fallback-font flash on cold load).
