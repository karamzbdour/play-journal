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
