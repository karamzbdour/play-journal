import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";
import { Weapon } from "../combat/Weapon";
import Health from "../combat/Health";
import { CombatEntity } from "../combat/CombatEntity";
import { SpriteManifest } from "../animation/SpriteManifest";
import { resolveClip } from "../animation/resolveAnimation";
import AnimationController from "../animation/AnimationController";

// Player movement modeled on the "05-physics" example from
// https://github.com/mikewesthad/phaser-3-tilemap-blog-posts (post-1): arcade physics body,
// 4-directional cursor input, velocity normalized so diagonal movement isn't faster.
const PLAYER_SPEED = 350;
const PLAYER_MAX_HP = 100;
const PLAYER_REGEN_DELAY_MS = 5000;
const PLAYER_REGEN_PER_SECOND = 5;

export default class Player implements CombatEntity {
  public sprite: Phaser.GameObjects.Sprite;
  public statusEffects: StatusEffectController = new StatusEffectController();
  public health: Health = new Health(PLAYER_MAX_HP, { delayMs: PLAYER_REGEN_DELAY_MS, perSecond: PLAYER_REGEN_PER_SECOND });
  public weapon: Weapon;
  public animationController: AnimationController;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  // Live world position, so the player can be passed anywhere a CombatEntity
  // is wanted without wrapping it in an adapter object.
  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  constructor(scene: Phaser.Scene, x: number, y: number, weapon: Weapon, manifest: SpriteManifest) {
    this.weapon = weapon;
    const idleClip = resolveClip(manifest, "idle");
    // Explicit frame 0, not the default __BASE frame (the whole unsliced spritesheet strip) -
    // physics.add.existing() below sizes the body from whatever frame is showing at this exact
    // moment, and __BASE's width covers every frame in the sheet, not just one.
    this.sprite = scene.add.sprite(x, y, idleClip.textureKey, 0);
    // Enemies/bosses are added to the scene after the player, and Phaser draws same-depth
    // GameObjects in insertion order - without this the player renders underneath them
    // whenever their sprites overlap.
    this.sprite.setDepth(1);
    scene.physics.add.existing(this.sprite);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.animationController = new AnimationController(scene, this.sprite, manifest);

    this.cursors = scene.input.keyboard!.createCursorKeys();
  }

  update(deltaMs: number) {
    this.statusEffects.update(deltaMs);
    this.health.update(deltaMs);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    const speed = PLAYER_SPEED * this.statusEffects.getMagnitude("slow", 1);

    if (this.cursors.left.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right.isDown) body.setVelocityX(speed);

    if (this.cursors.up.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down.isDown) body.setVelocityY(speed);

    // Normalize diagonal movement so it isn't faster than axis-aligned movement.
    body.velocity.normalize().scale(speed);

    const isMoving = body.velocity.x !== 0 || body.velocity.y !== 0;
    const movingLeft = body.velocity.x < 0;
    this.animationController.update(this.health.getRatio(), this.health.isDead, isMoving, movingLeft);
  }

  // Called when the scene stops driving update() (death, level complete) - without this the
  // physics body keeps drifting at its last velocity since nothing calls setVelocity(0) anymore.
  stop() {
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0);
  }
}
