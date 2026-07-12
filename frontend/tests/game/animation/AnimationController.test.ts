import { describe, it, expect, vi } from "vitest";
import type Phaser from "phaser";
import AnimationController from "@/game/animation/AnimationController";
import { SLICED_KNIGHT_MANIFEST } from "@/game/animation/SpriteProvider";

// sliced_knight has no dedicated hit/attack clips, so resolveClip falls back to the looping walk
// clip for both - the exact scenario that used to strand the controller in "hit"/"attack" forever
// (see AnimationController.play's fallback-detection comment).
function fakeScene(): Phaser.Scene {
  return {
    anims: {
      exists: () => false,
      create: vi.fn(),
      generateFrameNumbers: vi.fn(() => []),
    },
  } as unknown as Phaser.Scene;
}

// Mirrors production: Player/Enemy construct their sprite with the idle texture already showing
// (scene.add.sprite(x, y, idleClip.textureKey, 0)) before AnimationController exists, since its
// own constructor's play("idle") is a no-op (currentState already defaults to "idle").
function fakeSprite(initialKey: string) {
  return {
    currentKey: initialKey as string | undefined,
    play(key: string) {
      this.currentKey = key;
    },
    once: vi.fn(),
    setFlipX: vi.fn(),
  };
}

describe("AnimationController fallback states", () => {
  it("returns to idle after a hit whose manifest has no dedicated hit clip", () => {
    const sprite = fakeSprite(SLICED_KNIGHT_MANIFEST.clips.idle!.textureKey);
    const controller = new AnimationController(fakeScene(), sprite as unknown as Phaser.GameObjects.Sprite, SLICED_KNIGHT_MANIFEST);

    controller.update(0.9, false, false); // took damage, not moving -> triggers "hit"
    controller.update(0.9, false, false); // still not moving, health unchanged -> should be idle again

    expect(sprite.currentKey).toBe(SLICED_KNIGHT_MANIFEST.clips.idle!.textureKey);
  });

  it("returns to walk after a hit while moving, for a manifest with no dedicated hit clip", () => {
    const sprite = fakeSprite(SLICED_KNIGHT_MANIFEST.clips.idle!.textureKey);
    const controller = new AnimationController(fakeScene(), sprite as unknown as Phaser.GameObjects.Sprite, SLICED_KNIGHT_MANIFEST);

    controller.update(0.9, false, true); // took damage while moving -> "hit" (falls back to walk)
    controller.update(0.9, false, false); // stopped moving -> should now be idle, not stuck

    expect(sprite.currentKey).toBe(SLICED_KNIGHT_MANIFEST.clips.idle!.textureKey);
  });

  it("does not latch onto attack when the manifest has no dedicated attack clip", () => {
    const sprite = fakeSprite(SLICED_KNIGHT_MANIFEST.clips.idle!.textureKey);
    const controller = new AnimationController(fakeScene(), sprite as unknown as Phaser.GameObjects.Sprite, SLICED_KNIGHT_MANIFEST);

    controller.play("attack");
    controller.update(1, false, false); // not moving -> should be able to reach idle

    expect(sprite.currentKey).toBe(SLICED_KNIGHT_MANIFEST.clips.idle!.textureKey);
  });
});
