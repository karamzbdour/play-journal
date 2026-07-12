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
