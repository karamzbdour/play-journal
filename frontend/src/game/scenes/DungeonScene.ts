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
import { loadSettings, subscribeSettings } from "../settings";
import { getDisplayName } from "@/lib/auth";
import EnemyCombat from "../combat/EnemyCombat";
import PlayerCombat, { PhaserAttackInput } from "../combat/PlayerCombat";
import { LineOfSightBlocker } from "../combat/lineOfSight";
import { prettifyName } from "@/lib/format";
import { ClipDef, SpriteManifest } from "../animation/SpriteManifest";
import { SpriteProvider, LocalSpriteProvider, GENERIC_HUMANOID_MANIFEST, GENERIC_ENEMY_MANIFEST } from "../animation/SpriteProvider";
import { pickManifest } from "../animation/resolveAnimation";

// Room count scales length_of_day (Min: 5, Max: 10)
function getRoomCount(lengthOfDay: number): number {
  if (!Number.isFinite(lengthOfDay)) return 5;
  return Math.round(Math.min(10, Math.max(5, lengthOfDay)));
}

// Paints every generated room onto the ground layer: floor, corners, walls,
// and door openings punched through at the room's connection points.
function paintRooms(groundLayer: Phaser.Tilemaps.TilemapLayer, dungeon: Dungeon) {
  dungeon.rooms.forEach((room) => {
    const { x, y, width, height, left, right, top, bottom } = room;

    // Floor: mostly clean tiles, occasionally a dirty one
    groundLayer.weightedRandomize(TILE_MAPPING.FLOOR, x, y, width, height);

    // Room corners
    groundLayer.putTileAt(TILE_MAPPING.WALL.TOP_LEFT, left, top);
    groundLayer.putTileAt(TILE_MAPPING.WALL.TOP_RIGHT, right, top);
    groundLayer.putTileAt(TILE_MAPPING.WALL.BOTTOM_RIGHT, right, bottom);
    groundLayer.putTileAt(TILE_MAPPING.WALL.BOTTOM_LEFT, left, bottom);

    // Walls: mostly clean tiles, occasionally a dirty one
    groundLayer.weightedRandomize(TILE_MAPPING.WALL.TOP, left + 1, top, width - 2, 1);
    groundLayer.weightedRandomize(TILE_MAPPING.WALL.BOTTOM, left + 1, bottom, width - 2, 1);
    groundLayer.weightedRandomize(TILE_MAPPING.WALL.LEFT, left, top + 1, 1, height - 2);
    groundLayer.weightedRandomize(TILE_MAPPING.WALL.RIGHT, right, top + 1, 1, height - 2);

    // Doors punch through the wall at the room's connection points to its neighbors
    for (const door of room.getDoorLocations()) {
      if (door.y === 0) {
        groundLayer.putTilesAt(TILE_MAPPING.DOOR.TOP, x + door.x - 1, y + door.y);
      } else if (door.y === room.height - 1) {
        groundLayer.putTilesAt(TILE_MAPPING.DOOR.BOTTOM, x + door.x - 1, y + door.y);
      } else if (door.x === 0) {
        groundLayer.putTilesAt(TILE_MAPPING.DOOR.LEFT, x + door.x, y + door.y - 1);
      } else if (door.x === room.width - 1) {
        groundLayer.putTilesAt(TILE_MAPPING.DOOR.RIGHT, x + door.x, y + door.y - 1);
      }
    }
  });
}

const MANIFEST_FETCH_TIMEOUT_MS = 5000;
const LEVEL_COMPLETE_DELAY_MS = 1500;
// How close the player needs to be to the stairs' tile origin to trigger completion -
// generous enough that walking onto the tile from any side counts, without needing exact overlap.
const STAIRS_REACH_RADIUS = TILE_SIZE * 0.75;

// Places the stairs in the dungeon's last-generated room (distinct from the start room since
// maxRooms is always >= 5, see getRoomCount) and clears collision on that tile so it's walkable.
function placeStairs(map: Phaser.Tilemaps.Tilemap, stuffLayer: Phaser.Tilemaps.TilemapLayer, dungeon: Dungeon) {
  const finalRoom = dungeon.rooms[dungeon.rooms.length - 1];
  stuffLayer.putTileAt(TILE_MAPPING.STAIRS, finalRoom.centerX, finalRoom.centerY);
  stuffLayer.setCollision(TILE_MAPPING.STAIRS, false);
  return {
    x: map.tileToWorldX(finalRoom.centerX)!,
    y: map.tileToWorldY(finalRoom.centerY)!,
  };
}

// Never lets a slow/hanging SpriteProvider block dungeon creation - a timed-out fetch is treated
// the same as "sprite id not found" (see pickManifest).
function fetchManifestWithTimeout(provider: SpriteProvider, spriteId: string): Promise<SpriteManifest | null> {
  return Promise.race([
    provider.getManifest(spriteId).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), MANIFEST_FETCH_TIMEOUT_MS)),
  ]);
}

function queueManifestTextures(scene: Phaser.Scene, manifest: SpriteManifest, queued: Set<string>) {
  (Object.values(manifest.clips) as ClipDef[]).forEach((clip) => {
    if (queued.has(clip.textureKey) || scene.textures.exists(clip.textureKey)) return;
    queued.add(clip.textureKey);
    scene.load.spritesheet(clip.textureKey, clip.textureUrl, { frameWidth: clip.frameWidth, frameHeight: clip.frameHeight });
  });
}

function manifestHasFailedTexture(manifest: SpriteManifest, failedKeys: Set<string>): boolean {
  return (Object.values(manifest.clips) as ClipDef[]).some((clip) => failedKeys.has(clip.textureKey));
}

interface EnemyInstance {
  enemy: Enemy;
  combat: EnemyCombat;
  label: EntityLabel;
}

export function createDungeonScene(
  PhaserLib: typeof Phaser,
  config: GameConfig,
  fontFamily: string,
  onLevelComplete: () => void
) {
  return class DungeonScene extends PhaserLib.Scene {
    private player!: Player;
    private playerLabel!: EntityLabel;
    private enemyInstances: EnemyInstance[] = [];
    private playerCombat!: PlayerCombat;
    private isPlayerDead = false;
    private isLevelComplete = false;
    private stairsPosition!: { x: number; y: number };
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

    // Resolves the player/enemy sprite manifests (falling back to the generic manifests on fetch
    // failure, unknown id, or a texture actually failing to download) and loads every clip's
    // texture before returning, so by the time this resolves everything needed to build
    // Player/Enemy's AnimationControllers is already in the texture manager.
    private async loadEntityManifests(spriteProvider: SpriteProvider): Promise<{ player: SpriteManifest; enemy: SpriteManifest }> {
      const [playerFetched, enemyFetched] = await Promise.all([
        fetchManifestWithTimeout(spriteProvider, config.player_sprite),
        fetchManifestWithTimeout(spriteProvider, config.enemy_type),
      ]);

      let playerManifest = pickManifest("player", playerFetched);
      let enemyManifest = pickManifest("enemy", enemyFetched);

      const failedKeys = new Set<string>();
      this.load.on(PhaserLib.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => failedKeys.add(file.key));

      const queued = new Set<string>();
      // Always queue the generic manifests too, so there's a guaranteed-loaded fallback even if
      // a fetched manifest's own texture URLs 404 after the fetch itself succeeded.
      queueManifestTextures(this, GENERIC_HUMANOID_MANIFEST, queued);
      queueManifestTextures(this, GENERIC_ENEMY_MANIFEST, queued);
      queueManifestTextures(this, playerManifest, queued);
      queueManifestTextures(this, enemyManifest, queued);

      await new Promise<void>((resolve) => {
        this.load.once(PhaserLib.Loader.Events.COMPLETE, () => resolve());
        this.load.start();
      });

      if (manifestHasFailedTexture(playerManifest, failedKeys)) playerManifest = GENERIC_HUMANOID_MANIFEST;
      if (manifestHasFailedTexture(enemyManifest, failedKeys)) enemyManifest = GENERIC_ENEMY_MANIFEST;

      return { player: playerManifest, enemy: enemyManifest };
    }

    async create() {
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

      paintRooms(this.groundLayer, dungeon);

      // Everything except empty tiles and floor variants should block movement
      // hard-coded and needs changing when more tilemaps are added
      this.groundLayer.setCollisionByExclusion([-1, 6, 7, 8, 26]);
      this.stuffLayer.setCollisionByExclusion([-1, 6, 7, 8, 26]);

      this.stairsPosition = placeStairs(map, this.stuffLayer, dungeon);

      this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

      const spriteProvider = new LocalSpriteProvider();
      const { player: playerManifest, enemy: enemyManifest } = await this.loadEntityManifests(spriteProvider);

      const startRoom = dungeon.rooms[0];
      const playerX = map.tileToWorldX(startRoom.centerX)!;
      const playerY = map.tileToWorldY(startRoom.centerY)!;
      const weapon = generateWeapon(randomWeaponCategory());
      this.player = new Player(this, playerX, playerY, weapon, playerManifest);
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
      // Aggression 3 so the demo reaches all three example attacks (see combat/EnemyAttack.ts) over time.
      const enemy = new Enemy(this, enemyX, enemyY, config.enemy_color, 3, 50, enemyManifest);

      this.playerLabel = new EntityLabel(this, fontFamily, this.player.sprite, {
        name: getDisplayName() ?? "You",
        statusEffects: this.player.statusEffects,
        health: this.player.health,
      });
      this.playerLabel.setNameVisible(loadSettings().showPlayerName);
      const unsubscribeSettings = subscribeSettings((settings) => {
        this.playerLabel.setNameVisible(settings.showPlayerName);
      });
      this.events.once(PhaserLib.Scenes.Events.SHUTDOWN, unsubscribeSettings);
      this.events.once(PhaserLib.Scenes.Events.DESTROY, unsubscribeSettings);

      // Reuses the same .collides flag Phaser already computed for player-movement collision
      // (via setCollisionByExclusion above), so line-of-sight blocking always matches what
      // actually blocks movement.
      const blocker: LineOfSightBlocker = {
        isBlocked: (x, y) =>
          !!this.groundLayer.getTileAtWorldXY(x, y)?.collides || !!this.stuffLayer.getTileAtWorldXY(x, y)?.collides,
      };

      const enemyLabel = new EntityLabel(this, fontFamily, enemy.sprite, {
        name: prettifyName(config.enemy_type),
        statusEffects: enemy.statusEffects,
        health: enemy.health,
      });
      // Player and Enemy implement CombatEntity themselves (live x/y getters),
      // so both combat systems take the entities directly.
      const enemyCombat = new EnemyCombat(enemy, () => this.player, blocker, {
        onAttack: (attackId) => enemy.animationController.play("attack", { abilityId: attackId }),
      });
      this.enemyInstances = [{ enemy, combat: enemyCombat, label: enemyLabel }];

      this.playerCombat = new PlayerCombat(
        this.player.weapon,
        this.player,
        () => this.enemyInstances.map(({ enemy }) => enemy),
        blocker,
        new PhaserAttackInput(this),
        { onAttack: (attackId) => this.player.animationController.play("attack", { abilityId: attackId }) }
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
      // create() resolves sprite manifests asynchronously; guard against Phaser calling update()
      // on an earlier frame before it has finished.
      if (!this.player) return;
      if (this.isPlayerDead || this.isLevelComplete) return;

      this.player.update(delta);
      this.enemyInstances.forEach(({ enemy }) => enemy.update(delta));
      this.enemyInstances.forEach(({ combat }) => combat.update(delta));
      this.playerCombat.update(delta);

      this.removeDeadEnemies();

      this.playerLabel.update();
      this.enemyInstances.forEach(({ label }) => label.update());

      if (this.rainSpawnZone) {
        rainFollowCamera(this, this.rainSpawnZone);
      }

      if (this.player.health.isDead) {
        this.handlePlayerDeath();
        return;
      }

      if (this.hasReachedStairs()) {
        this.handleLevelComplete();
      }
    }

    private hasReachedStairs(): boolean {
      const dx = this.player.x - this.stairsPosition.x;
      const dy = this.player.y - this.stairsPosition.y;
      return dx * dx + dy * dy < STAIRS_REACH_RADIUS * STAIRS_REACH_RADIUS;
    }

    private removeDeadEnemies() {
      const alive: EnemyInstance[] = [];
      for (const instance of this.enemyInstances) {
        if (instance.enemy.health.isDead) {
          instance.label.destroy();
          instance.enemy.sprite.destroy();
        } else {
          alive.push(instance);
        }
      }
      this.enemyInstances = alive;
    }

    private handlePlayerDeath() {
      this.isPlayerDead = true;
      this.player.stop();
      this.add
        .text(this.scale.width / 2, this.scale.height / 2, "YOU DIED", {
          fontFamily,
          fontSize: "32px",
          color: "#ef4444",
          stroke: "#000000",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0);
    }

    private handleLevelComplete() {
      this.isLevelComplete = true;
      this.player.stop();
      this.add
        .text(this.scale.width / 2, this.scale.height / 2, "LEVEL COMPLETE", {
          fontFamily,
          fontSize: "32px",
          color: "#4ade80",
          stroke: "#000000",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0);
      this.time.delayedCall(LEVEL_COMPLETE_DELAY_MS, () => onLevelComplete());
    }
  };
}
