import type Phaser from "phaser";

// Player movement modeled on the "05-physics" example from
// https://github.com/mikewesthad/phaser-3-tilemap-blog-posts (post-1): arcade physics body,
// 4-directional cursor input, velocity normalized so diagonal movement isn't faster.
// No sprite/atlas assets yet, so the player is a plain circle for now.
const PLAYER_SPEED = 175;

export default class Player {
  public sprite: Phaser.GameObjects.Arc;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.circle(x, y, 8, 0xfacc15);
    scene.physics.add.existing(this.sprite);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    this.cursors = scene.input.keyboard!.createCursorKeys();
  }

  update() {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    if (this.cursors.left.isDown) body.setVelocityX(-PLAYER_SPEED);
    else if (this.cursors.right.isDown) body.setVelocityX(PLAYER_SPEED);

    if (this.cursors.up.isDown) body.setVelocityY(-PLAYER_SPEED);
    else if (this.cursors.down.isDown) body.setVelocityY(PLAYER_SPEED);

    // Normalize diagonal movement so it isn't faster than axis-aligned movement.
    body.velocity.normalize().scale(PLAYER_SPEED);
  }
}
