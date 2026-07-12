import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngjs from "pngjs";

const { PNG } = pngjs;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../public/sprites");

const FRAME_SIZE = 32;

// Must match the frameCount values in src/game/animation/SpriteProvider.ts's buildGenericManifest.
const STATES = [
  { name: "idle", frameCount: 2 },
  { name: "walk", frameCount: 4 },
  { name: "dash", frameCount: 3 },
  { name: "attack", frameCount: 3 },
  { name: "hit", frameCount: 2 },
  { name: "death", frameCount: 4 },
];

// [R, G, B] base color per sprite, so the two generic sprites are visually distinguishable.
const SPRITE_BASE_COLOR = {
  generic_humanoid: [56, 130, 246], // blue-ish
  generic_enemy: [220, 60, 60], // red-ish
};

function frameColor(base, frameIndex, frameCount) {
  const brightness = 0.55 + 0.45 * (frameCount === 1 ? 0 : frameIndex / (frameCount - 1));
  return base.map((channel) => Math.round(Math.min(255, channel * brightness)));
}

function writeSpritesheet(spriteId, state, frameCount) {
  const base = SPRITE_BASE_COLOR[spriteId];
  const width = FRAME_SIZE * frameCount;
  const png = new PNG({ width, height: FRAME_SIZE });

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    const [r, g, b] = frameColor(base, frameIndex, frameCount);
    for (let y = 0; y < FRAME_SIZE; y++) {
      for (let x = 0; x < FRAME_SIZE; x++) {
        const isBorder = x === 0 || y === 0 || x === FRAME_SIZE - 1 || y === FRAME_SIZE - 1;
        const px = frameIndex * FRAME_SIZE + x;
        const idx = (width * y + px) << 2;
        if (isBorder) {
          png.data[idx] = Math.round(r * 0.5);
          png.data[idx + 1] = Math.round(g * 0.5);
          png.data[idx + 2] = Math.round(b * 0.5);
        } else {
          png.data[idx] = r;
          png.data[idx + 1] = g;
          png.data[idx + 2] = b;
        }
        png.data[idx + 3] = 255;
      }
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `${spriteId}_${state}.png`);
  png.pack().pipe(fs.createWriteStream(outPath));
  console.log(`wrote ${outPath}`);
}

for (const spriteId of Object.keys(SPRITE_BASE_COLOR)) {
  for (const { name, frameCount } of STATES) {
    writeSpritesheet(spriteId, name, frameCount);
  }
}
