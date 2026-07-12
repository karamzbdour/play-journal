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
    this.playInternal(state, options);
  }

  // Shared by play() (gated by shouldInterrupt) and the animationcomplete handler below (which
  // must bypass that gate - it's not an external interrupt request, it's a one-shot clip like
  // "attack" handing control back once it's done. Since shouldInterrupt only lets a *higher*
  // priority state override the current one, and the clip that just finished IS the current
  // state, gating this call the same way as play() would always block it (attack/hit can never
  // out-rank themselves) and strand the controller on the last frame forever.
  private playInternal(state: AnimationState, options?: { abilityId?: string }): void {
    const requestedKey: ManifestKey = options?.abilityId ? `attack:${options.abilityId}` : state;
    const clip = resolveClip(this.manifest, requestedKey);

    // hit/attack are always authored with repeat: 0 (one-shot). If resolveClip had to fall back
    // to a looping walk/idle clip because this manifest has no dedicated art for `state` (e.g.
    // sliced_knight has no hit clip), there's nothing to actually show for it - leave the sprite
    // playing whatever it already was rather than switching to a clip with no way back (its
    // animationcomplete never fires, since it loops forever), which would otherwise strand the
    // controller in `state` and block walk/idle from ever taking back over.
    if ((state === "hit" || state === "attack") && clip.repeat !== 0) return;

    this.currentState = state;
    // Clears any listener left behind by a clip that got interrupted before it could naturally
    // complete (animationcomplete never fires for an interrupted clip, so `once` never
    // self-removed it) - otherwise it fires alongside this clip's own listener later.
    this.sprite.off("animationcomplete");
    this.sprite.play(clip.textureKey);

    if (clip.repeat === 0) {
      this.sprite.once("animationcomplete", () => {
        if (this.currentState === "death") return; // death latches even after its clip finishes
        this.playInternal(this.lastIsMoving ? "walk" : "idle");
      });
    }
  }

  // movingLeft only matters while isMoving; defaults false so non-directional callers don't need
  // to pass it. Set every frame (not gated by shouldInterrupt like play() is) so a direction
  // reversal mid-walk flips immediately instead of waiting for a state change.
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
