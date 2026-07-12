import { describe, it, expect } from "vitest";
import { sanitizeSettings, DEFAULT_SETTINGS } from "@/game/settings";

describe("sanitizeSettings", () => {
  it("returns defaults for missing or malformed input", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("junk")).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values", () => {
    expect(sanitizeSettings({ showPlayerName: false, difficulty: 8 })).toEqual({
      showPlayerName: false,
      difficulty: 8,
    });
  });

  it("clamps difficulty into the 1-10 range and rounds it", () => {
    expect(sanitizeSettings({ difficulty: 42 }).difficulty).toBe(10);
    expect(sanitizeSettings({ difficulty: -3 }).difficulty).toBe(1);
    expect(sanitizeSettings({ difficulty: 6.6 }).difficulty).toBe(7);
  });

  it("replaces wrong-typed fields with defaults", () => {
    expect(sanitizeSettings({ showPlayerName: "yes", difficulty: "hard" })).toEqual(
      DEFAULT_SETTINGS
    );
  });
});
