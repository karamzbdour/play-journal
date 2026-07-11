import type Phaser from "phaser";

const GRADIENT_STOPS = 12;
const EASE_POWER = 3.5; // higher = darkening/brightening stays concentrated nearer the edge

export interface VignetteOptions {
  key: string;
  rgb: [number, number, number];
  maxAlpha: number;
  blendMode?: "NORMAL" | "ADD" | "MULTIPLY" | "SCREEN";
}

// Draws a radial-gradient vignette (clear center, colored edges) into a canvas texture, since
// this Phaser build has no built-in camera vignette FX. Call once per scene; the returned image
// can be resized on window resize via setDisplaySize (the texture itself isn't regenerated).
// Different moods get different colors/blend modes (see moodTint.ts), each cached under its own
// texture key so the dark and warm variants don't clobber each other.
export function addVignette(scene: Phaser.Scene, width: number, height: number, options: VignetteOptions) {
  const { key, rgb, maxAlpha, blendMode = "NORMAL" } = options;
  const [r, g, b] = rgb;

  if (!scene.textures.exists(key)) {
    const canvasTexture = scene.textures.createCanvas(key, width, height)!;
    const ctx = canvasTexture.getContext();
    const cx = width / 2;
    const cy = height / 2;
    // Reach the corners regardless of aspect ratio, not just based on height
    const maxRadius = Math.hypot(cx, cy);

    // Gradient starts ramping from the exact center (r0 = 0) with an eased alpha curve, rather
    // than a flat zero-alpha disk that suddenly starts ramping at some inner radius - that flat
    // spot followed by a sharp derivative change is what reads as a faint "ring" (a Mach band),
    // even though the alpha value itself has no discontinuity there.
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
    for (let i = 0; i <= GRADIENT_STOPS; i++) {
      const t = i / GRADIENT_STOPS;
      const alpha = Math.pow(t, EASE_POWER) * maxAlpha; // ease-in so the center stays clean longer
      gradient.addColorStop(t, `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    canvasTexture.refresh();
  }

  return scene.add
    .image(0, 0, key)
    .setOrigin(0, 0)
    .setDisplaySize(width, height)
    .setScrollFactor(0)
    .setBlendMode(blendMode);
}
