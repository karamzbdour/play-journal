import { describe, it, expect, afterEach, vi } from "vitest";
import assignRoomKinds from "@/game/dungeon/assignRoomKinds";

describe("assignRoomKinds", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty assignment for an empty room list", () => {
    const assignments = assignRoomKinds([], [{ kind: "boss", count: 1 }]);
    expect(assignments.size).toBe(0);
  });

  it("returns an empty assignment when there's only a start room", () => {
    const assignments = assignRoomKinds(["start"], [{ kind: "boss", count: 1 }]);
    expect(assignments.size).toBe(0);
  });

  it("returns an empty assignment when there are only a start and end room, with nothing between", () => {
    const assignments = assignRoomKinds(["start", "end"], [{ kind: "boss", count: 1 }]);
    expect(assignments.size).toBe(0);
  });

  it("assigns the only candidate when there's exactly one room between start and end", () => {
    const assignments = assignRoomKinds(["start", "middle", "end"], [{ kind: "boss", count: 1 }]);
    expect(assignments.get("middle")).toBe("boss");
    expect(assignments.size).toBe(1);
  });

  it("never assigns the first or last room across many rooms", () => {
    const rooms = ["start", "a", "b", "c", "d", "end"];
    for (let i = 0; i < 20; i++) {
      const assignments = assignRoomKinds(rooms, [{ kind: "boss", count: 1 }]);
      expect(assignments.has("start")).toBe(false);
      expect(assignments.has("end")).toBe(false);
    }
  });

  it("assigns up to the requested count, one kind per room", () => {
    const rooms = ["start", "a", "b", "c", "d", "end"];
    const assignments = assignRoomKinds(rooms, [{ kind: "boss", count: 2 }]);
    const bossRooms = [...assignments.entries()].filter(([, kind]) => kind === "boss");
    expect(bossRooms).toHaveLength(2);
    expect(new Set(bossRooms.map(([room]) => room)).size).toBe(2); // no room picked twice
  });

  it("caps the assignment count at the number of available candidates instead of throwing", () => {
    const rooms = ["start", "middle", "end"];
    const assignments = assignRoomKinds(rooms, [{ kind: "boss", count: 5 }]);
    expect(assignments.size).toBe(1);
  });

  it("fills later quotas with whatever candidates remain after earlier ones", () => {
    const rooms = ["start", "a", "b", "end"];
    const assignments = assignRoomKinds(rooms, [
      { kind: "boss", count: 1 },
      { kind: "boss", count: 5 },
    ]);
    // Both candidates get used (first quota takes 1, second mops up the remaining 1), none left over.
    expect(assignments.size).toBe(2);
  });

  it("picks according to Math.random", () => {
    const rooms = ["start", "a", "b", "c", "end"];
    // Fisher-Yates with random() always 0: candidates ["a","b","c"] -> ["c","b","a"] -> ["b","c","a"].
    vi.spyOn(Math, "random").mockReturnValue(0);
    const assignments = assignRoomKinds(rooms, [{ kind: "boss", count: 1 }]);
    expect(assignments.get("b")).toBe("boss");
    expect(assignments.size).toBe(1);
  });
});
