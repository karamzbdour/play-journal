import type Phaser from "phaser";

const TEXTURE_KEY = "confetti-particle";
const CONFETTI_COLORS = [0xfacc15, 0xfb7185, 0x34d399, 0x60a5fa, 0xf472b6, 0xffffff];

// A gentle, continuous sprinkle of colored squares falling from the top of the screen, for happy
// days. Screen-space (scrollFactor 0), so it drifts down over the whole level regardless of where
// the camera is looking, like the mood tint and vignette.
export function addConfetti(scene: Phaser.Scene, width: number) {
  if (!scene.textures.exists(TEXTURE_KEY)) {
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(0, 0, 6, 6);
    gfx.generateTexture(TEXTURE_KEY, 6, 6);
    gfx.destroy();
  }

  return scene.add
    .particles(0, 0, TEXTURE_KEY, {
      x: { min: 0, max: width },
      y: -10,
      lifespan: 4000,
      speedY: { min: 60, max: 140 },
      speedX: { min: -40, max: 40 },
      gravityY: 40,
      rotate: { min: 0, max: 360 },
      scale: { min: 0.5, max: 1 },
      tint: CONFETTI_COLORS,
      frequency: 120,
      quantity: 1,
    })
    .setScrollFactor(0)
    .setDepth(2000);
}
