import type Phaser from "phaser";

// Static placeholder enemy - a colored circle with no movement/AI, matching Player's use of a
// plain circle in place of a sprite/atlas. Exists mainly to prove the nameplate system works on
// a non-player entity; real enemy behavior is a separate feature.
export default class Enemy {
  public sprite: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, color: string) {
    this.sprite = scene.add.circle(x, y, 8, parseInt(color.replace("#", ""), 16));
  }
}
