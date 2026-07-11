import type Phaser from "phaser";
import Dungeon from "@mikewesthad/dungeon";
import { TILE_SIZE } from "../constants";
import Player from "../entities/Player";
import Enemy from "../entities/Enemy";
import { generateWeapon, randomWeaponCategory } from "../combat/Weapon";
import TILE_MAPPING from "../tileMapping";
import { GameConfig } from "@/types/game";
import { getMoodTint } from "@/lib/moodTint";
import { addVignette } from "../effects/vignette";
import { addConfetti } from "../effects/confetti";
import { addRain, followCamera as rainFollowCamera } from "../effects/rain";
import EntityLabel from "../ui/EntityLabel";
import EnemyCombat, { CombatEntity, AggressiveCombatEntity } from "../combat/EnemyCombat";
import PlayerCombat, { PhaserAttackInput } from "../combat/PlayerCombat";
import { LineOfSightBlocker } from "../combat/lineOfSight";

// "deadline_demon" -> "Deadline Demon"
function prettifyName(slug: string): string {
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Room count scales length_of_day (Min: 5, Max: 10)
function getRoomCount(lengthOfDay: number): number {
  if (!Number.isFinite(lengthOfDay)) return 5;
  return Math.round(Math.min(10, Math.max(5, lengthOfDay)));
}

export function createDungeonScene(PhaserLib: typeof Phaser, config: GameConfig, fontFamily: string) {
  return class DungeonScene extends PhaserLib.Scene {
    private player!: Player;
    private enemies: Enemy[] = [];
    private entityLabels: EntityLabel[] = [];
    private enemyCombats: EnemyCombat[] = [];
    private playerCombat!: PlayerCombat;
    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private stuffLayer!: Phaser.Tilemaps.TilemapLayer;
    private moodOverlay!: Phaser.GameObjects.Rectangle;
    private vignette?: Phaser.GameObjects.Image;
    private rainSpawnZone?: { x: number; y: number; width: number; height: number; getRandomPoint(p: { x: number; y: number }): void };

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


      const tileset = map.addTilesetImage("tiles", undefined, TILE_SIZE, TILE_SIZE, 0, 0)!;
      this.groundLayer = map.createBlankLayer("Ground", tileset)!;
      // Second layer for items/decorations
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
      // hard-coded and needs changing when more tilemaps are added
      this.groundLayer.setCollisionByExclusion([-1, 6, 7, 8, 26]);
      this.stuffLayer.setCollisionByExclusion([-1, 6, 7, 8, 26]);

      this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

      const startRoom = dungeon.rooms[0];
      const playerX = map.tileToWorldX(startRoom.centerX)!;
      const playerY = map.tileToWorldY(startRoom.centerY)!;
      const weapon = generateWeapon(randomWeaponCategory());
      this.player = new Player(this, playerX, playerY, weapon);
      this.cameras.main.startFollow(this.player.sprite, true);

      this.physics.add.collider(this.player.sprite, this.groundLayer);
      this.physics.add.collider(this.player.sprite, this.stuffLayer);

      // Static demo enemy: a second room if the dungeon generated one, otherwise a point offset
      // from the player's spawn within the same room so the two don't overlap.
      const enemyRoom = dungeon.rooms[1] ?? startRoom;
      const enemyTileX = dungeon.rooms[1] ? enemyRoom.centerX : Math.min(enemyRoom.right - 1, enemyRoom.centerX + 2);
      const enemyTileY = dungeon.rooms[1] ? enemyRoom.centerY : Math.min(enemyRoom.bottom - 1, enemyRoom.centerY + 2);
      const enemyX = map.tileToWorldX(enemyTileX)!;
      const enemyY = map.tileToWorldY(enemyTileY)!;
      // Aggression 3 so the demo reaches all three example attacks (see combat/Attack.ts) over time.
      const enemy = new Enemy(this, enemyX, enemyY, config.enemy_color, 3, 50);
      this.enemies = [enemy];

      this.entityLabels = [
        new EntityLabel(this, fontFamily, this.player.sprite, { statusEffects: this.player.statusEffects }),
        new EntityLabel(this, fontFamily, enemy.sprite, {
          name: prettifyName(config.enemy_type),
          statusEffects: enemy.statusEffects,
        }),
      ];

      const getPlayerTarget = (): CombatEntity => ({
        x: this.player.sprite.x,
        y: this.player.sprite.y,
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      });

      // Reuses the same .collides flag Phaser already computed for player-movement collision
      // (via setCollisionByExclusion above), so line-of-sight blocking always matches what
      // actually blocks movement.
      const blocker: LineOfSightBlocker = {
        isBlocked: (x, y) =>
          !!this.groundLayer.getTileAtWorldXY(x, y)?.collides || !!this.stuffLayer.getTileAtWorldXY(x, y)?.collides,
      };

      this.enemyCombats = this.enemies.map((e) => {
        const combatEntity: AggressiveCombatEntity = {
          get x() {
            return e.sprite.x;
          },
          get y() {
            return e.sprite.y;
          },
          statusEffects: e.statusEffects,
          health: e.health,
          aggressionLevel: e.aggressionLevel,
        };
        return new EnemyCombat(combatEntity, getPlayerTarget, blocker);
      });

      const self = this;
      const playerSelf: CombatEntity = {
        get x() {
          return self.player.sprite.x;
        },
        get y() {
          return self.player.sprite.y;
        },
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      };
      const getEnemyTargets = (): CombatEntity[] =>
        this.enemies.map((e) => ({ x: e.sprite.x, y: e.sprite.y, statusEffects: e.statusEffects, health: e.health }));
      this.playerCombat = new PlayerCombat(
        this.player.weapon,
        playerSelf,
        getEnemyTargets,
        blocker,
        new PhaserAttackInput(this)
      );

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

      // Falling confetti for happy days, currently disabled.
      if (tint.confetti) {
        addConfetti(this, this.scale.width);
      }

      // Light rain for reflective days, world-space so it scrolls with the tiles (see rain.ts)
      if (tint.rain) {
        this.rainSpawnZone = addRain(this).spawnZone;
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

    update(time: number, delta: number) {
      this.player.update(delta);
      this.enemies.forEach((enemy) => enemy.update(delta));
      this.enemyCombats.forEach((combat) => combat.update(delta));
      this.playerCombat.update(delta);
      this.entityLabels.forEach((label) => label.update());
      if (this.rainSpawnZone) {
        rainFollowCamera(this, this.rainSpawnZone);
      }
    }
  };
}
