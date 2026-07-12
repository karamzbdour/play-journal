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

    // hit/attack are always authored with repeat: 0 (one-shot). If resolveClip had to fall back
    // to a looping walk/idle clip because this manifest has no dedicated art for `state` (e.g.
    // sliced_knight has no hit/attack clips), there's nothing to actually show for it - leave the
    // sprite playing whatever it already was rather than switching to a clip with no way back
    // (its animationcomplete never fires, since it loops forever), which would otherwise strand
    // the controller in `state` and block walk/idle from ever taking back over.
    if ((state === "hit" || state === "attack") && clip.repeat !== 0) return;

    this.currentState = state;
    this.sprite.play(clip.textureKey);

    if (clip.repeat === 0) {
      this.sprite.once("animationcomplete", () => {
        if (this.currentState === "death") return; // death latches even after its clip finishes
        this.play(this.lastIsMoving ? "walk" : "idle");
      });
    }
  }

  // movingLeft only matters while isMoving; defaults false so non-directional callers (Enemy,
  // which never moves) don't need to pass it. Set every frame (not gated by shouldInterrupt like
  // play() is) so a direction reversal mid-walk flips immediately instead of waiting for a state change.
  update(healthRatio: number, isDead: boolean, isMoving: boolean, movingLeft = false): void {
    this.lastIsMoving = isMoving;
    this.sprite.setFlipX(isMoving && movingLeft);

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
