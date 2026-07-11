import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";

// Static placeholder enemy - a colored circle with no movement/AI, matching Player's use of a
// plain circle in place of a sprite/atlas. Exists mainly to prove the nameplate and combat
// systems work on a non-player entity; real enemy movement/AI is a separate feature.
export default class Enemy {
  public sprite: Phaser.GameObjects.Arc;
  public statusEffects: StatusEffectController = new StatusEffectController();
  public aggressionLevel: number;

  constructor(scene: Phaser.Scene, x: number, y: number, color: string, aggressionLevel: number) {
    this.sprite = scene.add.circle(x, y, 8, parseInt(color.replace("#", ""), 16));
    this.aggressionLevel = aggressionLevel;
  }

  update(deltaMs: number) {
    this.statusEffects.update(deltaMs);
  }
}
