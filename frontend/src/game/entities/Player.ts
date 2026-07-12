import type Phaser from "phaser";
import StatusEffectController from "../combat/StatusEffectController";
import { Weapon } from "../combat/Weapon";
import Health from "../combat/Health";
import { CombatEntity } from "../combat/CombatEntity";

// Player movement modeled on the "05-physics" example from
// https://github.com/mikewesthad/phaser-3-tilemap-blog-posts (post-1): arcade physics body,
// 4-directional cursor input, velocity normalized so diagonal movement isn't faster.
// No sprite/atlas assets yet, so the player is a plain circle for now.
const PLAYER_SPEED = 350;
const PLAYER_MAX_HP = 100;

export default class Player implements CombatEntity {
  public sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;
  public statusEffects: StatusEffectController = new StatusEffectController();
  public health: Health = new Health(PLAYER_MAX_HP);
  public weapon: Weapon;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  // Live world position, so the player can be passed anywhere a CombatEntity
  // is wanted without wrapping it in an adapter object.
  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  constructor(scene: Phaser.Scene, x: number, y: number, weapon: Weapon) {
    this.weapon = weapon;
    if (scene.textures.exists("weapon")) {
      this.sprite = scene.add.sprite(x, y, "weapon");
      this.sprite.setDisplaySize(24, 24);
    } else {
      this.sprite = scene.add.circle(x, y, 8, 0xfacc15);
    }
    scene.physics.add.existing(this.sprite);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    this.cursors = scene.input.keyboard!.createCursorKeys();
  }

  update(deltaMs: number) {
    this.statusEffects.update(deltaMs);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    const speed = PLAYER_SPEED * this.statusEffects.getMagnitude("slow", 1);

    if (this.cursors.left.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right.isDown) body.setVelocityX(speed);

    if (this.cursors.up.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down.isDown) body.setVelocityY(speed);

    // Normalize diagonal movement so it isn't faster than axis-aligned movement.
    body.velocity.normalize().scale(speed);
  }
}
