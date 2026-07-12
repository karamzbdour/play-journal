import { describe, it, expect } from "vitest";
import { pickManifest, resolveClip, shouldInterrupt } from "@/game/animation/resolveAnimation";
import { GENERIC_HUMANOID_MANIFEST, GENERIC_ENEMY_MANIFEST } from "@/game/animation/SpriteProvider";
import { SpriteManifest } from "@/game/animation/SpriteManifest";

describe("pickManifest", () => {
  it("uses the fetched manifest when it has an idle clip", () => {
    const fetched: SpriteManifest = { spriteId: "custom", clips: { idle: GENERIC_HUMANOID_MANIFEST.clips.idle! } };
    expect(pickManifest("player", fetched)).toBe(fetched);
  });

  it("uses the fetched manifest when it only has a walk clip", () => {
    const fetched: SpriteManifest = { spriteId: "custom", clips: { walk: GENERIC_HUMANOID_MANIFEST.clips.walk! } };
    expect(pickManifest("player", fetched)).toBe(fetched);
  });

  it("falls back to the generic humanoid manifest when fetch returned null", () => {
    expect(pickManifest("player", null)).toBe(GENERIC_HUMANOID_MANIFEST);
  });

  it("falls back to the generic enemy manifest when fetch returned null", () => {
    expect(pickManifest("enemy", null)).toBe(GENERIC_ENEMY_MANIFEST);
  });

  it("falls back to generic when the fetched manifest has neither idle nor walk", () => {
    const fetched: SpriteManifest = { spriteId: "custom", clips: { attack: GENERIC_HUMANOID_MANIFEST.clips.attack! } };
    expect(pickManifest("player", fetched)).toBe(GENERIC_HUMANOID_MANIFEST);
  });
});

describe("resolveClip", () => {
  it("returns the exact clip when present", () => {
    expect(resolveClip(GENERIC_HUMANOID_MANIFEST, "walk")).toBe(GENERIC_HUMANOID_MANIFEST.clips.walk);
  });

  it("falls back to walk when the requested state is missing", () => {
    const manifest: SpriteManifest = { spriteId: "custom", clips: { walk: GENERIC_HUMANOID_MANIFEST.clips.walk! } };
    expect(resolveClip(manifest, "attack")).toBe(manifest.clips.walk);
  });

  it("falls back to idle when both the requested state and walk are missing", () => {
    const manifest: SpriteManifest = { spriteId: "custom", clips: { idle: GENERIC_HUMANOID_MANIFEST.clips.idle! } };
    expect(resolveClip(manifest, "attack")).toBe(manifest.clips.idle);
  });

  it("resolves an exact per-ability attack clip when present", () => {
    const abilityClip = GENERIC_HUMANOID_MANIFEST.clips.attack!;
    const manifest: SpriteManifest = {
      spriteId: "custom",
      clips: { idle: GENERIC_HUMANOID_MANIFEST.clips.idle!, "attack:puncture": abilityClip },
    };
    expect(resolveClip(manifest, "attack:puncture")).toBe(abilityClip);
  });

  it("falls back to the generic attack clip when a per-ability clip is missing", () => {
    const genericAttack = GENERIC_HUMANOID_MANIFEST.clips.attack!;
    const manifest: SpriteManifest = { spriteId: "custom", clips: { idle: GENERIC_HUMANOID_MANIFEST.clips.idle!, attack: genericAttack } };
    expect(resolveClip(manifest, "attack:puncture")).toBe(genericAttack);
  });

  it("falls further back to walk when a per-ability clip and the generic attack clip are both missing", () => {
    const manifest: SpriteManifest = { spriteId: "custom", clips: { walk: GENERIC_HUMANOID_MANIFEST.clips.walk! } };
    expect(resolveClip(manifest, "attack:puncture")).toBe(manifest.clips.walk);
  });

  it("throws when a manifest has neither the requested state nor walk nor idle", () => {
    const manifest: SpriteManifest = { spriteId: "custom", clips: { attack: GENERIC_HUMANOID_MANIFEST.clips.attack! } };
    expect(() => resolveClip(manifest, "hit")).toThrow();
  });
});

describe("shouldInterrupt", () => {
  it("never interrupts itself", () => {
    expect(shouldInterrupt("idle", "idle")).toBe(false);
    expect(shouldInterrupt("attack", "attack")).toBe(false);
  });

  it("death always latches - nothing interrupts it", () => {
    expect(shouldInterrupt("death", "idle")).toBe(false);
    expect(shouldInterrupt("death", "attack")).toBe(false);
    expect(shouldInterrupt("death", "hit")).toBe(false);
  });

  it("death interrupts everything else", () => {
    expect(shouldInterrupt("idle", "death")).toBe(true);
    expect(shouldInterrupt("walk", "death")).toBe(true);
    expect(shouldInterrupt("attack", "death")).toBe(true);
    expect(shouldInterrupt("hit", "death")).toBe(true);
  });

  it("attack blocks walk/idle from interrupting it", () => {
    expect(shouldInterrupt("attack", "walk")).toBe(false);
    expect(shouldInterrupt("attack", "idle")).toBe(false);
  });

  it("hit blocks walk/idle from interrupting it", () => {
    expect(shouldInterrupt("hit", "walk")).toBe(false);
    expect(shouldInterrupt("hit", "idle")).toBe(false);
  });

  it("hit does not interrupt an in-progress attack", () => {
    expect(shouldInterrupt("attack", "hit")).toBe(false);
  });

  it("a new attack does interrupt a brief hit-react", () => {
    expect(shouldInterrupt("hit", "attack")).toBe(true);
  });

  it("walk and idle freely swap with each other", () => {
    expect(shouldInterrupt("idle", "walk")).toBe(true);
    expect(shouldInterrupt("walk", "idle")).toBe(true);
  });
});
