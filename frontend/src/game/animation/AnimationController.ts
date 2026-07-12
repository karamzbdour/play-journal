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
