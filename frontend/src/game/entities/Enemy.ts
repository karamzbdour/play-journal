import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";
import Health from "../combat/Health";
import { AggressiveCombatEntity } from "../combat/CombatEntity";
import { hexToNumber } from "@/lib/color";

// Static placeholder enemy - a colored circle with no movement/AI, matching Player's use of a
// plain circle in place of a sprite/atlas. Exists mainly to prove the nameplate and combat
// systems work on a non-player entity; real enemy movement/AI is a separate feature.
export default class Enemy implements AggressiveCombatEntity {
  public sprite: Phaser.GameObjects.Arc;
  public statusEffects: StatusEffectController;
  public health: Health;
  public aggressionLevel: number;

  // Live world position, so the enemy can be passed anywhere a CombatEntity
  // is wanted without wrapping it in an adapter object.
  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  constructor(scene: Phaser.Scene, x: number, y: number, color: string, aggressionLevel: number, maxHp: number) {
    this.sprite = scene.add.circle(x, y, 8, hexToNumber(color));
    this.aggressionLevel = aggressionLevel;
    this.health = new Health(maxHp);
    this.statusEffects = new StatusEffectController((amount) => this.health.takeDamage(amount));
  }

  update(deltaMs: number) {
    this.statusEffects.update(deltaMs);
  }
}
