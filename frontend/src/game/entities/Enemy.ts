import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";
import Health from "../combat/Health";
import { AggressiveCombatEntity } from "../combat/CombatEntity";
import { hexToNumber } from "@/lib/color";
import { SpriteManifest } from "../animation/SpriteManifest";
import { resolveClip } from "../animation/resolveAnimation";
import AnimationController from "../animation/AnimationController";

// A physics-backed enemy. Movement decisions live in EnemyAI (which sets this sprite's body
// velocity); this class owns the body itself and derives animation state from whatever velocity
// the AI last set, mirroring how Player derives its animation from input-driven velocity.
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
    // Explicit frame 0, not the default __BASE frame (the whole unsliced spritesheet strip) -
    // see the matching comment in Player.ts for why this matters once a body is attached.
    this.sprite = scene.add.sprite(x, y, idleClip.textureKey, 0);
    this.sprite.setTint(hexToNumber(color));
    this.aggressionLevel = aggressionLevel;
    this.health = new Health(maxHp);
    this.animationController = new AnimationController(scene, this.sprite, manifest);
    scene.physics.add.existing(this.sprite);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
  }

  update(deltaMs: number) {
    this.statusEffects.update(deltaMs);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (this.health.isDead) body.setVelocity(0);

    const isMoving = body.velocity.x !== 0 || body.velocity.y !== 0;
    this.animationController.update(this.health.getRatio(), this.health.isDead, isMoving, body.velocity.x < 0);
  }

  // Called when the scene stops driving update() (death, level complete) - without this the
  // physics body keeps drifting at its last velocity since nothing calls setVelocity(0) anymore.
  stop() {
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0);
  }
}
