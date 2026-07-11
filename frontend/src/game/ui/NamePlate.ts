import type Phaser from "phaser";

// Anything with a world position can have a nameplate - a Player's sprite, an Enemy's sprite,
// or any future entity. No coupling to a specific entity class.
export interface NamePlateTarget {
  x: number;
  y: number;
}

export interface NamePlateOptions {
  offsetY?: number;
  color?: string;
  fontSize?: string;
}

const DEFAULT_OFFSET_Y = 18;
const DEFAULT_COLOR = "#f8fafc";
const DEFAULT_FONT_SIZE = "12px";

export default class NamePlate {
  private text: Phaser.GameObjects.Text;
  private target: NamePlateTarget;
  private offsetY: number;

  constructor(
    scene: Phaser.Scene,
    fontFamily: string,
    target: NamePlateTarget,
    name: string,
    options?: NamePlateOptions
  ) {
    this.target = target;
    this.offsetY = options?.offsetY ?? DEFAULT_OFFSET_Y;

    this.text = scene.add
      .text(target.x, target.y - this.offsetY, name, {
        fontFamily,
        fontSize: options?.fontSize ?? DEFAULT_FONT_SIZE,
        color: options?.color ?? DEFAULT_COLOR,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);
  }

  update() {
    this.text.setPosition(this.target.x, this.target.y - this.offsetY);
  }

  destroy() {
    this.text.destroy();
  }
}
