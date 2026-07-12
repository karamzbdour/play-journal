import { describe, it, expect, vi } from "vitest";
import Door, { DoorTileLayer } from "@/game/dungeon/Door";

function createLayer(): DoorTileLayer {
  return { putTileAt: vi.fn(), removeTileAt: vi.fn() };
}

describe("Door", () => {
  it("starts open", () => {
    const door = new Door(createLayer(), 3, 4, 39);
    expect(door.isOpen).toBe(true);
  });

  it("close() puts the closed tile at the door's position and marks it closed", () => {
    const layer = createLayer();
    const door = new Door(layer, 3, 4, 39);

    door.close();

    expect(door.isOpen).toBe(false);
    expect(layer.putTileAt).toHaveBeenCalledTimes(1);
    expect(layer.putTileAt).toHaveBeenCalledWith(39, 3, 4);
    expect(layer.removeTileAt).not.toHaveBeenCalled();
  });

  it("open() removes the tile at the door's position and marks it open", () => {
    const layer = createLayer();
    const door = new Door(layer, 3, 4, 39);
    door.close();
    vi.clearAllMocks();

    door.open();

    expect(door.isOpen).toBe(true);
    expect(layer.removeTileAt).toHaveBeenCalledTimes(1);
    expect(layer.removeTileAt).toHaveBeenCalledWith(3, 4);
    expect(layer.putTileAt).not.toHaveBeenCalled();
  });

  it("close() is a no-op when already closed", () => {
    const layer = createLayer();
    const door = new Door(layer, 3, 4, 39);
    door.close();
    vi.clearAllMocks();

    door.close();

    expect(layer.putTileAt).not.toHaveBeenCalled();
  });

  it("open() is a no-op when already open", () => {
    const layer = createLayer();
    const door = new Door(layer, 3, 4, 39);

    door.open();

    expect(layer.removeTileAt).not.toHaveBeenCalled();
  });
});
