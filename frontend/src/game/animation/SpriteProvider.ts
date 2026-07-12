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
