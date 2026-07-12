import type Phaser from "phaser";

const MARGIN_X = 32;
const MARGIN_BOTTOM = 28;
const MAX_WIDTH = 720;
const MIN_WIDTH = 280;
const PADDING_X = 28;
const PADDING_TOP = 22;
const PADDING_BOTTOM = 18;
const EYEBROW_ROW_HEIGHT = 22;
const BORDER_WIDTH = 6;
const DEPTH = 1000;

// Colors lifted from globals.css's --parchment/--leather/--ink tome palette, so the in-game
// banner reads as the same object as the journal chrome around it.
const COLOR_PARCHMENT_DEEP = 0xd9c69e;
const COLOR_LEATHER = 0x2c1a10;
const COLOR_INK = "#2e2418";
const COLOR_INK_FADED = "#6b5a41";

// Parchment-and-leather dialogue banner pinned to the bottom of the screen. Displays `lines` one
// at a time; SPACE advances to the next, and calls onComplete once the player advances past the
// last one (the caller is expected to destroy/drop its reference then - this class doesn't
// resurrect itself). Built for level-start tutorial text (GameConfig.game_rules) but takes any
// string[], so it's reusable for other on-theme in-game messaging later.
export default class TutorialBanner {
  private index = 0;
  private spaceKey: Phaser.Input.Keyboard.Key;
  private wasSpaceDown = false;
  private destroyed = false;

  private frame: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private eyebrow: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private prompt: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private fontFamily: string,
    private lines: readonly string[],
    private onComplete?: () => void
  ) {
    this.frame = scene.add.rectangle(0, 0, 10, 10, COLOR_LEATHER).setScrollFactor(0).setDepth(DEPTH);
    this.panel = scene.add.rectangle(0, 0, 10, 10, COLOR_PARCHMENT_DEEP).setScrollFactor(0).setDepth(DEPTH + 1);

    this.eyebrow = scene.add
      .text(0, 0, "TUTORIAL", { fontFamily, fontSize: "11px", color: COLOR_INK_FADED })
      .setScrollFactor(0)
      .setDepth(DEPTH + 2);

    // Same blocky pixel font as entity nametags (EntityLabel), not the journal's cursive hand -
    // legibility matters more here than matching the written-page look.
    this.body = scene.add
      .text(0, 0, "", { fontFamily, fontSize: "16px", color: COLOR_INK, lineSpacing: 6 })
      .setScrollFactor(0)
      .setDepth(DEPTH + 2);

    this.prompt = scene.add
      .text(0, 0, "", { fontFamily, fontSize: "11px", color: COLOR_INK })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH + 2);

    this.spaceKey = scene.input.keyboard!.addKey("SPACE");

    this.render();
  }

  // Called every frame while active. Re-lays-out on every call (cheap - a handful of
  // setPosition/setSize calls) so a mid-tutorial window resize doesn't leave the banner
  // misaligned until the next line change.
  update(): void {
    if (this.destroyed) return;

    this.layout();

    const isDown = this.spaceKey.isDown;
    const justPressed = isDown && !this.wasSpaceDown;
    this.wasSpaceDown = isDown;
    if (!justPressed) return;

    this.advance();
  }

  private advance(): void {
    this.index += 1;
    if (this.index >= this.lines.length) {
      this.destroy();
      this.onComplete?.();
      return;
    }
    this.render();
  }

  private render(): void {
    this.body.setText(this.lines[this.index]);
    const isLast = this.index === this.lines.length - 1;
    this.prompt.setText(`${this.index + 1}/${this.lines.length}  ·  SPACE ${isLast ? "to begin" : "to continue"}`);
    this.layout();
  }

  private layout(): void {
    const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, this.scene.scale.width - MARGIN_X * 2));
    this.body.setWordWrapWidth(width - PADDING_X * 2);

    const height = PADDING_TOP + EYEBROW_ROW_HEIGHT + this.body.height + PADDING_BOTTOM;
    const x = this.scene.scale.width / 2 - width / 2;
    const y = this.scene.scale.height - MARGIN_BOTTOM - height;

    this.frame.setPosition(x + width / 2, y + height / 2);
    this.frame.setSize(width + BORDER_WIDTH * 2, height + BORDER_WIDTH * 2);
    this.panel.setPosition(x + width / 2, y + height / 2);
    this.panel.setSize(width, height);

    this.eyebrow.setPosition(x + PADDING_X, y + PADDING_TOP - 4);
    this.body.setPosition(x + PADDING_X, y + PADDING_TOP + EYEBROW_ROW_HEIGHT - 6);
    this.prompt.setPosition(x + width - PADDING_X, y + height - PADDING_BOTTOM + 4);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.frame.destroy();
    this.panel.destroy();
    this.eyebrow.destroy();
    this.body.destroy();
    this.prompt.destroy();
  }
}
