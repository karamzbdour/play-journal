import type Phaser from "phaser";
import Dungeon from "@mikewesthad/dungeon";
import { TILE_SIZE } from "../constants";
import Player from "../entities/Player";
import TILE_MAPPING from "../tileMapping";
import { GameConfig } from "@/types/game";
import { getMoodTint } from "@/lib/moodTint";
import { addVignette } from "../effects/vignette";
import { addConfetti } from "../effects/confetti";

// Room count scales with the journal entry's length_of_day: use the value directly between
// 6-10, clamp to 10 above that, and clamp to 5 at or below 5. Falls back to 5 if the value is
// missing or not a real number (e.g. a backend response that predates this field) - otherwise
// Math.max/min would propagate NaN into Dungeon's maxRooms and silently cap generation at 1 room.
function getRoomCount(lengthOfDay: number): number {
  if (!Number.isFinite(lengthOfDay)) return 5;
  return Math.round(Math.min(10, Math.max(5, lengthOfDay)));
}

// Step 1: generate a dungeon (https://github.com/mikewesthad/phaser-3-tilemap-blog-posts, post-3).
// Step 2: a player (post-1's movement pattern) spawned in the first room, camera follows it.
// Step 3: a real tilemap layer using the loaded tileset, replacing the rectangle placeholders.
// Step 4: "better mapping" - proper corner/wall/door tiles per room via TILE_MAPPING, instead of
// a flat floor/wall/door fill.
// Step 5: wall collision, via setCollisionByExclusion on the walkable tile indices.
//
// Note: weightedRandomize's argument order is (weightedIndexes, x, y, width, height) in this
// Phaser version - the original tutorial (written against an older Phaser 3.x) has the indexes
// last, so this isn't a direct copy-paste of that snippet.
export function createDungeonScene(PhaserLib: typeof Phaser, config: GameConfig) {
  return class DungeonScene extends PhaserLib.Scene {
    private player!: Player;
    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private stuffLayer!: Phaser.Tilemaps.TilemapLayer;
    private moodOverlay!: Phaser.GameObjects.Rectangle;
    private vignette?: Phaser.GameObjects.Image;

    constructor() {
      super("DungeonScene");
    }

    preload() {
      this.load.image("tiles", "/tilesets/buch-tileset-48px.png");
    }

    create() {
      const dungeon = new Dungeon({
        width: 50,
        height: 50,
        doorPadding: 2,
        rooms: {
          width: { min: 7, max: 15, onlyOdd: true },
          height: { min: 7, max: 15, onlyOdd: true },
          maxRooms: getRoomCount(config.length_of_day),
        },
      });

      // Create a blank map matching the dungeon's dimensions
      const map = this.make.tilemap({
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
        width: dungeon.width,
        height: dungeon.height,
      });

      // Non-extruded tileset - no margin/spacing baked in
      const tileset = map.addTilesetImage("tiles", undefined, TILE_SIZE, TILE_SIZE, 0, 0)!;
      this.groundLayer = map.createBlankLayer("Ground", tileset)!;
      // Second layer for items/decorations (chests, pots, towers, stairs) - empty for now
      this.stuffLayer = map.createBlankLayer("Stuff", tileset)!;

      // Fill each room with floor, corner, wall and door tiles from TILE_MAPPING
      dungeon.rooms.forEach((room) => {
        const { x, y, width, height, left, right, top, bottom } = room;

        // Floor: mostly clean tiles, occasionally a dirty one
        this.groundLayer.weightedRandomize(TILE_MAPPING.FLOOR, x, y, width, height);

        // Room corners
        this.groundLayer.putTileAt(TILE_MAPPING.WALL.TOP_LEFT, left, top);
        this.groundLayer.putTileAt(TILE_MAPPING.WALL.TOP_RIGHT, right, top);
        this.groundLayer.putTileAt(TILE_MAPPING.WALL.BOTTOM_RIGHT, right, bottom);
          this.groundLayer.putTileAt(TILE_MAPPING.WALL.BOTTOM_LEFT, left, bottom);

        // Walls: mostly clean tiles, occasionally a dirty one
        this.groundLayer.weightedRandomize(TILE_MAPPING.WALL.TOP, left + 1, top, width - 2, 1);
        this.groundLayer.weightedRandomize(TILE_MAPPING.WALL.BOTTOM, left + 1, bottom, width - 2, 1);
        this.groundLayer.weightedRandomize(TILE_MAPPING.WALL.LEFT, left, top + 1, 1, height - 2);
        this.groundLayer.weightedRandomize(TILE_MAPPING.WALL.RIGHT, right, top + 1, 1, height - 2);

        // Doors punch through the wall at the room's connection points to its neighbors
        const doors = room.getDoorLocations();
        for (let i = 0; i < doors.length; i++) {
          if (doors[i].y === 0) {
            this.groundLayer.putTilesAt(TILE_MAPPING.DOOR.TOP, x + doors[i].x - 1, y + doors[i].y);
          } else if (doors[i].y === room.height - 1) {
            this.groundLayer.putTilesAt(TILE_MAPPING.DOOR.BOTTOM, x + doors[i].x - 1, y + doors[i].y);
          } else if (doors[i].x === 0) {
            this.groundLayer.putTilesAt(TILE_MAPPING.DOOR.LEFT, x + doors[i].x, y + doors[i].y - 1);
          } else if (doors[i].x === room.width - 1) {
            this.groundLayer.putTilesAt(TILE_MAPPING.DOOR.RIGHT, x + doors[i].x, y + doors[i].y - 1);
          }
        }
      });

      // Everything except empty tiles and floor variants should block movement
      this.groundLayer.setCollisionByExclusion([-1, 6, 7, 8, 26]);
      this.stuffLayer.setCollisionByExclusion([-1, 6, 7, 8, 26]);

      this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

      const startRoom = dungeon.rooms[0];
      const playerX = map.tileToWorldX(startRoom.centerX)!;
      const playerY = map.tileToWorldY(startRoom.centerY)!;
      this.player = new Player(this, playerX, playerY);
      this.cameras.main.startFollow(this.player.sprite, true);

      this.physics.add.collider(this.player.sprite, this.groundLayer);
      this.physics.add.collider(this.player.sprite, this.stuffLayer);

      // Full-screen mood tint over the whole level, so the run feels different depending on
      // whether the journal entry read as a good day or a bad one (see src/lib/moodTint.ts).
      const tint = getMoodTint(config.mood);
      this.moodOverlay = this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, tint.color, tint.alpha)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setBlendMode(tint.blendMode);
      this.scale.on(PhaserLib.Scale.Events.RESIZE, (gameSize: { width: number; height: number }) => {
        this.moodOverlay.setSize(gameSize.width, gameSize.height);
        this.vignette?.setDisplaySize(gameSize.width, gameSize.height);
      });

      // Extra colored vignette for moods that call for one, layered above the mood tint
      if (tint.vignette) {
        this.vignette = addVignette(this, this.scale.width, this.scale.height, tint.vignette);
      }

      // Falling confetti for happy days
      if (tint.confetti) {
        addConfetti(this, this.scale.width);
      }

      this.add
        .text(100, 10, `${dungeon.rooms.length} rooms generated`, {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#e2e8f0",
          backgroundColor: "#0f172a",
          padding: { x: 6, y: 4 },
        })
        .setScrollFactor(0);
    }

    update() {
      this.player.update();
    }
  };
}
