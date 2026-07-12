import { describe, it, expect, afterEach, vi } from "vitest";
import selectBossRoom from "@/game/dungeon/selectBossRoom";

describe("selectBossRoom", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for an empty list", () => {
    expect(selectBossRoom([])).toBeNull();
  });

  it("returns null when there's only a start room", () => {
    expect(selectBossRoom(["start"])).toBeNull();
  });

  it("returns null when there are only a start and end room, with nothing between", () => {
    expect(selectBossRoom(["start", "end"])).toBeNull();
  });

  it("returns the only candidate when there's exactly one room between start and end", () => {
    expect(selectBossRoom(["start", "middle", "end"])).toBe("middle");
  });

  it("never returns the first or last room across many rooms", () => {
    const rooms = ["start", "a", "b", "c", "d", "end"];
    for (let i = 0; i < 20; i++) {
      const picked = selectBossRoom(rooms);
      expect(picked).not.toBe("start");
      expect(picked).not.toBe("end");
    }
  });

  it("picks according to Math.random", () => {
    const rooms = ["start", "a", "b", "c", "end"];
    vi.spyOn(Math, "random").mockReturnValue(0.5); // middle of 3 candidates -> index 1
    expect(selectBossRoom(rooms)).toBe("b");
  });
});
