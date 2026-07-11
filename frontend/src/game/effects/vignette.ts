import type Phaser from "phaser";

const MAX_ALPHA = 0.85;
const GRADIENT_STOPS = 12;
const EASE_POWER = 3.5; // higher = darkening stays concentrated nearer the edge

// Draws a radial-gradient vignette (clear center, dark edges) into a canvas texture, since this
// Phaser build has no built-in camera vignette FX. Call once per scene; the returned image can be
// resized on window resize via setDisplaySize (the texture itself isn't regenerated).
export function addVignette(scene: Phaser.Scene, width: number, height: number) {
  const key = "vignette";

  if (!scene.textures.exists(key)) {
    const canvasTexture = scene.textures.createCanvas(key, width, height)!;
    const ctx = canvasTexture.getContext();
    const cx = width / 2;
    const cy = height / 2;
    // Reach the corners regardless of aspect ratio, not just based on height
    const maxRadius = Math.hypot(cx, cy);

    // Gradient starts ramping from the exact center (r0 = 0) with an eased alpha curve, rather
    // than a flat transparent disk that suddenly starts ramping at some inner radius - that flat
    // spot followed by a sharp derivative change is what reads as a faint "ring" (a Mach band),
    // even though the alpha value itself has no discontinuity there.
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
    for (let i = 0; i <= GRADIENT_STOPS; i++) {
      const t = i / GRADIENT_STOPS;
      const alpha = Math.pow(t, EASE_POWER) * MAX_ALPHA; // ease-in so the center stays clean longer
      gradient.addColorStop(t, `rgba(0, 0, 0, ${alpha.toFixed(3)})`);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    canvasTexture.refresh();
  }

  return scene.add
    .image(0, 0, key)
    .setOrigin(0, 0)
    .setDisplaySize(width, height)
    .setScrollFactor(0);
}
