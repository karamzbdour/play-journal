import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngjs from "pngjs";

const { PNG } = pngjs;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../public/sprites");
const FRAME_SIZE = 32;

// Frame files pulled from the sliced_rogues sheets, keyed by output state. idle/walk come from
// sliced_knight/ (row0 - subtle stance, row1 - visible leg/cape motion). Walking left is just
// the walk clip mirrored at render time (AnimationController's flipX), not separate art. death
// comes from sliced_knight2/, a second character sheet in the same layout (row6 - lying-down pose).
const STATES = {
  idle: { sourceDir: "sliced_knight", frames: ["sprite_r00_c00.png", "sprite_r00_c01.png"] },
  walk: {
    sourceDir: "sliced_knight",
    frames: ["sprite_r01_c00.png", "sprite_r01_c02.png", "sprite_r01_c04.png", "sprite_r01_c06.png"],
  },
  death: {
    sourceDir: "sliced_knight2",
    frames: ["sprite_r06_c00.png", "sprite_r06_c01.png", "sprite_r06_c02.png", "sprite_r06_c03.png"],
  },
};

function readFramePng(sourceDir, fileName) {
  const data = fs.readFileSync(path.resolve(__dirname, "../public/sprites", sourceDir, fileName));
  return PNG.sync.read(data);
}

function writeStrip(state, sourceDir, fileNames) {
  const frames = fileNames.map((fileName) => readFramePng(sourceDir, fileName));
  const width = FRAME_SIZE * frames.length;
  const strip = new PNG({ width, height: FRAME_SIZE });

  frames.forEach((frame, frameIndex) => {
    for (let y = 0; y < FRAME_SIZE; y++) {
      for (let x = 0; x < FRAME_SIZE; x++) {
        const srcIdx = (frame.width * y + x) << 2;
        const dstIdx = (width * y + (frameIndex * FRAME_SIZE + x)) << 2;
        strip.data[dstIdx] = frame.data[srcIdx];
        strip.data[dstIdx + 1] = frame.data[srcIdx + 1];
        strip.data[dstIdx + 2] = frame.data[srcIdx + 2];
        strip.data[dstIdx + 3] = frame.data[srcIdx + 3];
      }
    }
  });

  const outPath = path.join(OUTPUT_DIR, `sliced_knight_${state}.png`);
  strip.pack().pipe(fs.createWriteStream(outPath));
  console.log(`wrote ${outPath}`);
}

for (const [state, { sourceDir, frames }] of Object.entries(STATES)) {
  writeStrip(state, sourceDir, frames);
}
