import type Phaser from "phaser";
import Dungeon from "@mikewesthad/dungeon";
import { TILE_SIZE } from "../constants";
import Player from "../entities/Player";

// Step 1 of the dungeon-crawler rebuild (modeled on
// https://github.com/mikewesthad/phaser-3-tilemap-blog-posts, post-3): generate a dungeon and
// draw its rooms as plain rectangles, no tile art yet.
// Step 2: a player (post-1's movement pattern) spawned in the first room, camera follows it.
// No tile collision yet - the room rectangles are just visuals until real tilemap layers exist.
export function createDungeonScene(PhaserLib: typeof Phaser) {
  return class DungeonScene extends PhaserLib.Scene {
    private player!: Player;

    constructor() {
      super("DungeonScene");
    }

    create() {
      const dungeon = new Dungeon({
        width: 50,
        height: 50,
        doorPadding: 2,
        rooms: {
          width: { min: 7, max: 15, onlyOdd: true },
          height: { min: 7, max: 15, onlyOdd: true },
          maxRooms: 10,
        },
      });

      const graphics = this.add.graphics();
      dungeon.rooms.forEach((room) => {
        const x = room.x * TILE_SIZE;
        const y = room.y * TILE_SIZE;
        const w = room.width * TILE_SIZE;
        const h = room.height * TILE_SIZE;

        graphics.fillStyle(0x2dd4bf, 0.25);
        graphics.fillRect(x, y, w, h);
        graphics.lineStyle(2, 0x2dd4bf, 1);
        graphics.strokeRect(x, y, w, h);
      });

      const worldWidth = dungeon.width * TILE_SIZE;
      const worldHeight = dungeon.height * TILE_SIZE;
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

      const startRoom = dungeon.rooms[0];
      const playerX = startRoom.centerX * TILE_SIZE;
      const playerY = startRoom.centerY * TILE_SIZE;
      this.player = new Player(this, playerX, playerY);
      this.cameras.main.startFollow(this.player.sprite, true);

      this.add
        .text(10, 10, `${dungeon.rooms.length} rooms generated`, {
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
