import type Phaser from "phaser";
import TILE_MAPPING from "../tileMapping";
import { DungeonRoom } from "./DungeonRoom";

// Structures stay 2 tiles clear of the walls so they can never block a doorway (doors are punched
// into the walls, so the tile just inside a door is 1 tile from the wall) or pin the player
// against one, and the center 3x3 stays clear because boss rooms spawn their boss at the center.
const STRUCTURE_WALL_MARGIN = 2;
const CENTER_CLEARANCE = 1;
const MIN_STRUCTURES_PER_ROOM = 1;
const MAX_STRUCTURES_PER_ROOM = 3;
const PLACEMENT_ATTEMPTS = 20;

const POT_INDEXES = TILE_MAPPING.POT.map((pot) => pot.index);
const TOWER_INDEXES = TILE_MAPPING.TOWER.flat();

function randomPotIndex(): number {
  return POT_INDEXES[Math.floor(Math.random() * POT_INDEXES.length)];
}

function isPlaceable(stuffLayer: Phaser.Tilemaps.TilemapLayer, room: DungeonRoom, tileX: number, tileY: number): boolean {
  const insideMargin =
    tileX >= room.left + STRUCTURE_WALL_MARGIN &&
    tileX <= room.right - STRUCTURE_WALL_MARGIN &&
    tileY >= room.top + STRUCTURE_WALL_MARGIN &&
    tileY <= room.bottom - STRUCTURE_WALL_MARGIN;
  const inCenterClearance =
    Math.abs(tileX - room.centerX) <= CENTER_CLEARANCE && Math.abs(tileY - room.centerY) <= CENTER_CLEARANCE;
  return insideMargin && !inCenterClearance && !stuffLayer.getTileAt(tileX, tileY);
}

function placeInRoom(stuffLayer: Phaser.Tilemaps.TilemapLayer, room: DungeonRoom): void {
  const structureCount =
    MIN_STRUCTURES_PER_ROOM + Math.floor(Math.random() * (MAX_STRUCTURES_PER_ROOM - MIN_STRUCTURES_PER_ROOM + 1));

  for (let i = 0; i < structureCount; i++) {
    const isTower = Math.random() < 0.5;

    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const x = room.left + Math.floor(Math.random() * (room.right - room.left + 1));
      const y = room.top + Math.floor(Math.random() * (room.bottom - room.top + 1));
      if (!isPlaceable(stuffLayer, room, x, y)) continue;
      // Towers are 2 tiles tall (see TILE_MAPPING.TOWER), so both tiles must be valid.
      if (isTower && !isPlaceable(stuffLayer, room, x, y + 1)) continue;

      if (isTower) {
        stuffLayer.putTilesAt(TILE_MAPPING.TOWER, x, y);
      } else {
        stuffLayer.putTileAt(randomPotIndex(), x, y);
      }
      break;
    }
  }
}

// Scatters a few solid structures (towers, pots) around each given room to break up the open
// floor. They're placed on the stuff layer and registered as colliding, so they both block
// movement and - via the line-of-sight blocker built from layer collision flags in DungeonScene -
// serve as cover the player can break enemy sight lines behind. Callers pass only the rooms that
// should get structures (i.e. not the start or stairs rooms). Small rooms (7x7, the generator's
// minimum) have no tiles satisfying the margins, so they naturally stay empty.
export default function placeRoomStructures(stuffLayer: Phaser.Tilemaps.TilemapLayer, rooms: readonly DungeonRoom[]): void {
  rooms.forEach((room) => placeInRoom(stuffLayer, room));
  // Explicit registration for the same reason as the closed-door tiles in DungeonScene: the
  // layer's setCollisionByExclusion only covers indexes present when it runs.
  stuffLayer.setCollision([...POT_INDEXES, ...TOWER_INDEXES], true);
}
