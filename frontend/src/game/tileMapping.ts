// Centralized tile indices for the Buch dungeon tileset, mirroring tile-mapping.js from
// https://github.com/mikewesthad/phaser-3-tilemap-blog-posts (post-3).
const TILE_MAPPING = {
  WALL: {
    TOP_LEFT: 3,
    TOP_RIGHT: 4,
    BOTTOM_RIGHT: 23,
    BOTTOM_LEFT: 22,
    TOP: [
      { index: 39, weight: 4 },
      { index: [57, 58, 59], weight: 1 },
    ],
    LEFT: [
      { index: 21, weight: 4 },
      { index: [76, 95, 114], weight: 1 },
    ],
    RIGHT: [
      { index: 19, weight: 4 },
      { index: [77, 96, 115], weight: 1 },
    ],
    BOTTOM: [
      { index: 1, weight: 4 },
      { index: [78, 79, 80], weight: 1 },
    ],
  },
  FLOOR: [
    { index: 6, weight: 9 },
    { index: [7, 8, 26], weight: 1 },
  ],
  POT: [
    { index: 13, weight: 1 },
    { index: 32, weight: 1 },
    { index: 51, weight: 1 },
  ],
  DOOR: {
    TOP: [40, 6, 38],
    LEFT: [
      [40],
      [6],
      [2],
    ],
    BOTTOM: [2, 6, 0],
    RIGHT: [
      [38],
      [6],
      [0],
    ],
    // Tile placed over a door's single walkable tile to seal it shut (see game/dungeon/Door.ts).
    // Reuses the ordinary wall tiles so a closed door reads as sealed stone.
    CLOSED: {
      HORIZONTAL: 39, // WALL.TOP - for doors in the top/bottom wall
      VERTICAL: 21, // WALL.LEFT - for doors in the left/right wall
    },
  },
  CHEST: 166,
  STAIRS: 81,
  TOWER: [
    [186],
    [205],
  ],
};

export default TILE_MAPPING;
