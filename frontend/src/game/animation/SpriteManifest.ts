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
