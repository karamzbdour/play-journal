import { describe, it, expect } from "vitest";
import { LocalSpriteProvider, GENERIC_HUMANOID_MANIFEST, GENERIC_ENEMY_MANIFEST } from "@/game/animation/SpriteProvider";
import { AnimationState } from "@/game/animation/SpriteManifest";

const ALL_STATES: AnimationState[] = ["idle", "walk", "dash", "attack", "hit", "death"];

describe("generic manifests", () => {
  it("generic_humanoid defines every animation state", () => {
    for (const state of ALL_STATES) {
      expect(GENERIC_HUMANOID_MANIFEST.clips[state]).toBeDefined();
    }
  });

  it("generic_enemy defines every animation state", () => {
    for (const state of ALL_STATES) {
      expect(GENERIC_ENEMY_MANIFEST.clips[state]).toBeDefined();
    }
  });

  it("generic_humanoid and generic_enemy use distinct texture keys", () => {
    expect(GENERIC_HUMANOID_MANIFEST.clips.idle!.textureKey).not.toBe(GENERIC_ENEMY_MANIFEST.clips.idle!.textureKey);
  });
});

describe("LocalSpriteProvider", () => {
  it("resolves a manifest for the known 'programmer' sprite id", async () => {
    const provider = new LocalSpriteProvider();
    const manifest = await provider.getManifest("programmer");
    expect(manifest?.spriteId).toBe("programmer");
    expect(manifest?.clips.idle).toBeDefined();
  });

  it("resolves a manifest for the known 'bug' sprite id", async () => {
    const provider = new LocalSpriteProvider();
    const manifest = await provider.getManifest("bug");
    expect(manifest?.spriteId).toBe("bug");
  });

  it("resolves null for an unrecognized sprite id", async () => {
    const provider = new LocalSpriteProvider();
    const manifest = await provider.getManifest("some_totally_unknown_sprite");
    expect(manifest).toBeNull();
  });

  it("the 'programmer' manifest deliberately omits attack/hit/dash clips, to exercise fallback", async () => {
    const provider = new LocalSpriteProvider();
    const manifest = await provider.getManifest("programmer");
    expect(manifest?.clips.attack).toBeUndefined();
    expect(manifest?.clips.hit).toBeUndefined();
    expect(manifest?.clips.dash).toBeUndefined();
    expect(manifest?.clips.idle).toBeDefined();
    expect(manifest?.clips.walk).toBeDefined();
  });
});
