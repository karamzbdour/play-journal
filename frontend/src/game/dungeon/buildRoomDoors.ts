import type Phaser from "phaser";
import Door from "./Door";
import TILE_MAPPING from "../tileMapping";
import { DungeonRoom } from "./DungeonRoom";

// One Door per connection point on a room's boundary, used to seal a special room (boss, swarm,
// ...) shut once the player enters. A door local to the top/bottom wall (door.y is 0 or
// height-1) is sealed with the horizontal wall tile; one on the left/right wall with the vertical
// tile - see TILE_MAPPING.DOOR.CLOSED.
export default function buildRoomDoors(stuffLayer: Phaser.Tilemaps.TilemapLayer, room: DungeonRoom): Door[] {
  return room.getDoorLocations().map((door) => {
    const isHorizontalWall = door.y === 0 || door.y === room.height - 1;
    const closedTileIndex = isHorizontalWall
      ? TILE_MAPPING.DOOR.CLOSED.HORIZONTAL
      : TILE_MAPPING.DOOR.CLOSED.VERTICAL;
    return new Door(stuffLayer, room.x + door.x, room.y + door.y, closedTileIndex);
  });
}
