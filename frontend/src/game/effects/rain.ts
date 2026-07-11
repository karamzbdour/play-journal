import type Phaser from "phaser";

const TEXTURE_KEY = "rain-drop";

interface SpawnZone {
  x: number;
  y: number;
  width: number;
  height: number;
  getRandomPoint(point: { x: number; y: number }): void;
}

function createSpawnZone(x: number, y: number, width: number): SpawnZone {
  const zone: SpawnZone = {
    x,
    y,
    width,
    height: 1,
    getRandomPoint(point) {
      point.x = zone.x + Math.random() * zone.width;
      point.y = zone.y;
    },
  };
  return zone;
}

// A light rain effect for reflective/moody days.
//
// World-space (not screen-locked like confetti.ts), so its fall motion stays visually consistent
// with the dungeon tiles regardless of the player's own movement.
//
// The emitter itself is created at world (0, 0) and MUST stay there permanently - Phaser's
// particle system stores each particle's position relative to the emitter's own transform (like
// a Container), so repositioning the emitter to chase the camera would drag every already-falling
// drop along with it each frame, not just decide where new ones spawn. That was the actual cause
// of the "faster when moving down" bug: it added the camera's own per-frame scroll delta on top
// of each drop's independent fall velocity. Instead, only the emitZone (a plain rectangle-ish
// spawn region, mutated every frame in followCamera) tracks the camera, so it decides where NEW
// drops appear without ever touching already-alive ones.
export function addRain(scene: Phaser.Scene) {
  if (!scene.textures.exists(TEXTURE_KEY)) {
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(0xa5c4e0, 1);
    gfx.fillRect(0, 0, 2, 14);
    gfx.generateTexture(TEXTURE_KEY, 2, 14);
    gfx.destroy();
  }

  const worldView = scene.cameras.main.worldView;
  const spawnZone = createSpawnZone(worldView.x, worldView.y - 20, worldView.width);

  const emitter = scene.add.particles(0, 0, TEXTURE_KEY, {
    lifespan: 1200,
    speedY: { min: 500, max: 650 },
    speedX: { min: -40, max: -10 },
    alpha: { min: 0.15, max: 0.35 },
    scaleY: { min: 0.6, max: 1 },
    quantity: 1,
    frequency: 60,
    emitZone: { type: "random", source: spawnZone },
  });

  return { emitter, spawnZone };
}

export function followCamera(scene: Phaser.Scene, spawnZone: SpawnZone) {
  const worldView = scene.cameras.main.worldView;
  spawnZone.x = worldView.x;
  spawnZone.y = worldView.y - 20;
  spawnZone.width = worldView.width;
}
