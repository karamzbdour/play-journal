import { describe, it, expect } from "vitest";
import RoomEncounter, { EncounterHealth, TileBounds } from "@/game/dungeon/RoomEncounter";
import Door, { DoorTileLayer } from "@/game/dungeon/Door";

const INTERIOR: TileBounds = { left: 5, right: 9, top: 5, bottom: 9 };
const OUTSIDE_POINT = { x: 0, y: 0 };
const INSIDE_POINT = { x: 7, y: 7 };
// Exactly on the boundary ring (a door tile itself) - not yet "inside" the interior.
const BOUNDARY_POINT = { x: 5, y: 4 };

function createDoor(): Door {
  const noopLayer: DoorTileLayer = { putTileAt: () => {}, removeTileAt: () => {} };
  return new Door(noopLayer, 0, 0, 39);
}

function alive(): EncounterHealth {
  return { isDead: false };
}

function dead(): EncounterHealth {
  return { isDead: true };
}

describe("RoomEncounter", () => {
  it("leaves the doors open while the player stays outside the interior", () => {
    const door = createDoor();
    const encounter = new RoomEncounter(INTERIOR, [door], [alive()]);

    encounter.update(OUTSIDE_POINT.x, OUTSIDE_POINT.y);

    expect(door.isOpen).toBe(true);
  });

  it("leaves the doors open while the player is standing on the boundary/door tile", () => {
    const door = createDoor();
    const encounter = new RoomEncounter(INTERIOR, [door], [alive()]);

    encounter.update(BOUNDARY_POINT.x, BOUNDARY_POINT.y);

    expect(door.isOpen).toBe(true);
  });

  it("closes every door once the player steps into the interior", () => {
    const doors = [createDoor(), createDoor()];
    const encounter = new RoomEncounter(INTERIOR, doors, [alive()]);

    encounter.update(INSIDE_POINT.x, INSIDE_POINT.y);

    expect(doors.every((d) => !d.isOpen)).toBe(true);
  });

  it("does not reopen the doors just because an enemy is still alive and the player left", () => {
    const door = createDoor();
    const encounter = new RoomEncounter(INTERIOR, [door], [alive()]);

    encounter.update(INSIDE_POINT.x, INSIDE_POINT.y);
    encounter.update(OUTSIDE_POINT.x, OUTSIDE_POINT.y);

    expect(door.isOpen).toBe(false);
  });

  it("opens every door once the single enemy is dead", () => {
    const doors = [createDoor(), createDoor()];
    const boss = alive();
    const encounter = new RoomEncounter(INTERIOR, doors, [boss]);
    encounter.update(INSIDE_POINT.x, INSIDE_POINT.y);
    expect(doors.every((d) => !d.isOpen)).toBe(true);

    (boss as { isDead: boolean }).isDead = true;
    encounter.update(INSIDE_POINT.x, INSIDE_POINT.y);

    expect(doors.every((d) => d.isOpen)).toBe(true);
    expect(encounter.isCleared).toBe(true);
  });

  it("stays sealed while any enemy in a multi-enemy room is still alive", () => {
    const doors = [createDoor()];
    const survivor = alive();
    const encounter = new RoomEncounter(INTERIOR, doors, [dead(), dead(), survivor]);

    encounter.update(INSIDE_POINT.x, INSIDE_POINT.y);

    expect(doors.every((d) => !d.isOpen)).toBe(true);
    expect(encounter.isCleared).toBe(false);
  });

  it("clears a multi-enemy room only once every enemy is dead", () => {
    const doors = [createDoor()];
    const last = alive();
    const encounter = new RoomEncounter(INTERIOR, doors, [dead(), dead(), last]);
    encounter.update(INSIDE_POINT.x, INSIDE_POINT.y);
    expect(encounter.isCleared).toBe(false);

    (last as { isDead: boolean }).isDead = true;
    encounter.update(INSIDE_POINT.x, INSIDE_POINT.y);

    expect(encounter.isCleared).toBe(true);
    expect(doors.every((d) => d.isOpen)).toBe(true);
  });

  it("does not re-trigger the trap after the room has been cleared", () => {
    const door = createDoor();
    const encounter = new RoomEncounter(INTERIOR, [door], [dead()]);

    encounter.update(INSIDE_POINT.x, INSIDE_POINT.y);
    expect(door.isOpen).toBe(true);

    door.close(); // simulate something else closing it
    encounter.update(INSIDE_POINT.x, INSIDE_POINT.y);

    expect(door.isOpen).toBe(false);
  });

  it("marks the encounter cleared immediately if every enemy is already dead", () => {
    const encounter = new RoomEncounter(INTERIOR, [], [dead(), dead()]);

    encounter.update(OUTSIDE_POINT.x, OUTSIDE_POINT.y);

    expect(encounter.isCleared).toBe(true);
  });
});
