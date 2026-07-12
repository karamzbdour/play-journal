import { AnimationState, ClipDef, SpriteManifest } from "./SpriteManifest";
import { AssetSelection } from "@/types/game";

export interface SpriteProvider {
  getManifest(spriteId: string): Promise<SpriteManifest | null>;
}

// Sentinel spriteId for boss lookups - doesn't match any real player/enemy sprite id, so
// LocalSpriteProvider can tell "give me the boss-flavored pick" apart from the regular enemy
// lookup (which prefers type "enemy") without changing the SpriteProvider interface.
export const BOSS_SPRITE_ID = "__boss__";

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

// Fully populated (all six AnimationStates) - the only manifests required to be complete.
// GENERIC_ENEMY_MANIFEST is the guaranteed-safe fallback for any enemy sprite id
// resolveAnimation.ts can't otherwise resolve; the player-side equivalent is
// SLICED_KNIGHT_MANIFEST below (real art beats a placeholder box). Frame counts here must match
// frontend/scripts/generate-placeholder-sprites.mjs.
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

// Sprite cut from sliced_rogues character sheets (see public/sprites/sliced_knight/,
// sliced_knight2/, and scripts/build-sliced-knight-sprite.mjs). idle/walk/attack/death are real
// frames from the sheets; hit intentionally has no clip here and falls back to walk/idle via
// resolveAnimation.ts's resolveClip rather than guessing which sheet rows mean what. Walking left
// is just the walk clip mirrored (AnimationController flips the sprite via flipX), not separate art.
// Doubles as pickManifest's player-side fallback (see resolveAnimation.ts) when a sprite id can't
// be fetched or resolved - idle/walk/death is enough for hasFallbackBase to accept it, and it's
// real art rather than a placeholder box.
export const SLICED_KNIGHT_MANIFEST: SpriteManifest = {
  spriteId: "sliced_knight",
  clips: {
    idle: clip("sliced_knight", "idle", { frameCount: 1, frameRate: 4, repeat: -1 }),
    walk: clip("sliced_knight", "walk", { frameCount: 4, frameRate: 8, repeat: -1 }),
    attack: clip("sliced_knight", "attack", { frameCount: 3, frameRate: 12, repeat: 0 }),
    death: clip("sliced_knight", "death", { frameCount: 4, frameRate: 6, repeat: 0 }),
  },
};

// Dev/test implementation - a couple of hardcoded, deliberately sparse manifests (matching
// mockGameConfig's player_sprite: "sliced_knight" and enemy_type: "bug"), reusing the generic
// manifests' clips/art so no extra placeholder assets are needed. Unknown ids resolve null so
// the fallback path is exercised. The real DB-backed provider implements this same interface
// later - no other code changes required to swap it in.
export class LocalSpriteProvider implements SpriteProvider {
  private manifests: Record<string, SpriteManifest> = {
    sliced_knight: SLICED_KNIGHT_MANIFEST,
    bug: {
      spriteId: "bug",
      clips: {
        idle: GENERIC_ENEMY_MANIFEST.clips.idle!,
        walk: GENERIC_ENEMY_MANIFEST.clips.walk!,
        death: GENERIC_ENEMY_MANIFEST.clips.death!,
      },
    },
  };

  constructor(private assetUrls?: AssetSelection[]) {}

  async getManifest(spriteId: string): Promise<SpriteManifest | null> {
    if (this.assetUrls && Array.isArray(this.assetUrls)) {
      const isPlayer = spriteId === "sliced_knight" || spriteId === "generic_humanoid";
      const isBoss = spriteId === BOSS_SPRITE_ID;
      const customAsset = isPlayer
        ? (this.assetUrls.find((a) => a.type === "weapon") || this.assetUrls.find((a) => a.type === "player"))
        : isBoss
          ? (this.assetUrls.find((a) => a.type === "boss") || this.assetUrls.find((a) => a.type === "enemy"))
          : (this.assetUrls.find((a) => a.type === "enemy") || this.assetUrls.find((a) => a.type === "boss"));

      if (customAsset) {
        return {
          spriteId,
          clips: {
            idle: {
              textureKey: `${spriteId}_idle`,
              textureUrl: customAsset.url,
              frameWidth: 32,
              frameHeight: 32,
              frameCount: 2,
              frameRate: 4,
              repeat: -1,
            },
            walk: {
              textureKey: `${spriteId}_walk`,
              textureUrl: customAsset.url,
              frameWidth: 32,
              frameHeight: 32,
              frameCount: 4,
              frameRate: 8,
              repeat: -1,
            },
            death: {
              textureKey: `${spriteId}_death`,
              textureUrl: customAsset.url,
              frameWidth: 32,
              frameHeight: 32,
              frameCount: 4,
              frameRate: 6,
              repeat: 0,
            },
          },
        };
      }
    }
    return this.manifests[spriteId] ?? null;
  }
}
