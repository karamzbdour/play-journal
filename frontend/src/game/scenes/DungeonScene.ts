import type Phaser from "phaser";
import Dungeon from "@mikewesthad/dungeon";
import { TILE_SIZE } from "../constants";
import Player from "../entities/Player";
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
import PlayerCombat, { PhaserAttackInput } from "../combat/PlayerCombat";
import { LineOfSightBlocker } from "../combat/lineOfSight";
import { ClipDef, SpriteManifest } from "../animation/SpriteManifest";
import { SpriteProvider, LocalSpriteProvider, SLICED_KNIGHT_MANIFEST, GENERIC_ENEMY_MANIFEST, BOSS_SPRITE_ID } from "../animation/SpriteProvider";
import { pickManifest } from "../animation/resolveAnimation";
import { DungeonRoom } from "../dungeon/DungeonRoom";
import RoomEncounter from "../dungeon/RoomEncounter";
import EnemySpawner, { SpawnedEnemy } from "../dungeon/EnemySpawner";
import { spawnBossRoom, spawnSwarmRoom } from "../dungeon/roomSpawnStrategies";
import assignRoomKinds from "../dungeon/assignRoomKinds";
import buildRoomDoors from "../dungeon/buildRoomDoors";
import placeRoomStructures from "../dungeon/placeRoomStructures";
import Door from "../dungeon/Door";
import TutorialBanner from "../ui/TutorialBanner";

// Room count scales length_of_day (Min: 5, Max: 10)
function getRoomCount(lengthOfDay: number): number {
  if (!Number.isFinite(lengthOfDay)) return 5;
  return Math.round(Math.min(10, Math.max(5, lengthOfDay)));
}

// One boss room per every 5 generated rooms (minimum 1), so bigger dungeons get more boss
// encounters instead of always just one regardless of size.
function getBossRoomCount(totalRooms: number): number {
  return Math.max(1, Math.floor(totalRooms / 5));
}

// Swarm rooms are a bit more common than boss rooms - lighter encounters that pad out the run
// without every special room being a boss fight.
function getSwarmRoomCount(totalRooms: number): number {
  return Math.max(1, Math.floor(totalRooms / 4));
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

// Places the stairs at the center of the given room and clears collision on that tile so it's
// walkable.
function placeStairs(map: Phaser.Tilemaps.Tilemap, stuffLayer: Phaser.Tilemaps.TilemapLayer, room: DungeonRoom) {
  stuffLayer.putTileAt(TILE_MAPPING.STAIRS, room.centerX, room.centerY);
  stuffLayer.setCollision(TILE_MAPPING.STAIRS, false);
  return {
    x: map.tileToWorldX(room.centerX)!,
    y: map.tileToWorldY(room.centerY)!,
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

export function createDungeonScene(
  PhaserLib: typeof Phaser,
  config: GameConfig,
  fontFamily: string,
  onLevelComplete: () => void
) {
  return class DungeonScene extends PhaserLib.Scene {
    private player!: Player;
    private playerLabel!: EntityLabel;
    private enemyInstances: SpawnedEnemy[] = [];
    private playerCombat!: PlayerCombat;
    private isPlayerDead = false;
    private isLevelComplete = false;
    private tutorialBanner?: TutorialBanner;
    private stairsPosition!: { x: number; y: number };
    private map!: Phaser.Tilemaps.Tilemap;
    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private stuffLayer!: Phaser.Tilemaps.TilemapLayer;
    private roomEncounters: RoomEncounter[] = [];
    private finalRoomDoors: Door[] = [];
    private bossEncounters: RoomEncounter[] = [];
    private moodOverlay!: Phaser.GameObjects.Rectangle;
    private vignette?: Phaser.GameObjects.Image;
    private rainSpawnZone?: { x: number; y: number; width: number; height: number; getRandomPoint(p: { x: number; y: number }): void };

    constructor() {
      super("DungeonScene");
    }

    preload() {
      this.load.image("tiles", "/tilesets/buch-tileset-48px.png");
    }

    // Resolves the player/enemy sprite manifests (falling back to the sliced knight for the
    // player and the generic manifest for the enemy on fetch failure, unknown id, or a texture
    // actually failing to download) and loads every clip's texture before returning, so by the
    // time this resolves everything needed to build Player/Enemy's AnimationControllers is
    // already in the texture manager.
    private async loadEntityManifests(spriteProvider: SpriteProvider): Promise<{ player: SpriteManifest; enemy: SpriteManifest; boss: SpriteManifest }> {
      const [playerFetched, enemyFetched, bossFetched] = await Promise.all([
        fetchManifestWithTimeout(spriteProvider, config.player_sprite),
        fetchManifestWithTimeout(spriteProvider, config.enemy_type),
        fetchManifestWithTimeout(spriteProvider, BOSS_SPRITE_ID),
      ]);

      let playerManifest = pickManifest("player", playerFetched);
      let enemyManifest = pickManifest("enemy", enemyFetched);
      // Boss falls back through the same generic enemy placeholder as regular enemies - there's
      // no dedicated "generic boss" art, and a distinct boss-typed asset (see SpriteProvider's
      // BOSS_SPRITE_ID handling) is preferred over it whenever one is available.
      let bossManifest = pickManifest("enemy", bossFetched);

      const failedKeys = new Set<string>();
      this.load.on(PhaserLib.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => failedKeys.add(file.key));

      const queued = new Set<string>();
      // Always queue the fallback manifests too, so there's a guaranteed-loaded fallback even if
      // a fetched manifest's own texture URLs 404 after the fetch itself succeeded.
      queueManifestTextures(this, SLICED_KNIGHT_MANIFEST, queued);
      queueManifestTextures(this, GENERIC_ENEMY_MANIFEST, queued);
      queueManifestTextures(this, playerManifest, queued);
      queueManifestTextures(this, enemyManifest, queued);
      queueManifestTextures(this, bossManifest, queued);

      await new Promise<void>((resolve) => {
        this.load.once(PhaserLib.Loader.Events.COMPLETE, () => resolve());
        this.load.start();
      });

      if (manifestHasFailedTexture(playerManifest, failedKeys)) playerManifest = SLICED_KNIGHT_MANIFEST;
      if (manifestHasFailedTexture(enemyManifest, failedKeys)) enemyManifest = GENERIC_ENEMY_MANIFEST;
      if (manifestHasFailedTexture(bossManifest, failedKeys)) bossManifest = GENERIC_ENEMY_MANIFEST;

      return { player: playerManifest, enemy: enemyManifest, boss: bossManifest };
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

      this.map = map;
      const tileset = map.addTilesetImage("tiles", undefined, TILE_SIZE, TILE_SIZE, 0, 0)!;
      this.groundLayer = map.createBlankLayer("Ground", tileset)!;
      // Second layer for items/decorations
      this.stuffLayer = map.createBlankLayer("Stuff", tileset)!;

      paintRooms(this.groundLayer, dungeon);

      // Everything except empty tiles and floor variants should block movement
      // hard-coded and needs changing when more tilemaps are added
      this.groundLayer.setCollisionByExclusion([-1, 6, 7, 8, 26]);
      this.stuffLayer.setCollisionByExclusion([-1, 6, 7, 8, 26]);
      // setCollisionByExclusion above only registers indexes already present in the (still blank)
      // stuffLayer, so the closed-door tiles - not placed until a Door actually closes - need to
      // be registered explicitly or they'd render but not collide.
      this.stuffLayer.setCollision(
        [TILE_MAPPING.DOOR.CLOSED.HORIZONTAL, TILE_MAPPING.DOOR.CLOSED.VERTICAL],
        true
      );

      const startRoom = dungeon.rooms[0];
      const finalRoom = dungeon.rooms[dungeon.rooms.length - 1];
      this.stairsPosition = placeStairs(map, this.stuffLayer, finalRoom);

      // Solid cover structures in every room except the start room (a clean spawn) and the
      // stairs room (keeps the exit approach clear). Placed before enemies spawn so swarm spawn
      // picks can see (and avoid) the occupied tiles.
      placeRoomStructures(this.stuffLayer, dungeon.rooms.slice(1, -1));

      // Special rooms are assigned strictly between the start and end rooms, so the player can
      // neither spawn in one nor find the stairs sealed inside one - see assignRoomKinds and
      // EnemySpawner for the door-sealing logic. Dungeons that generate too few rooms for a
      // valid middle choice simply get fewer (or zero) special rooms.
      const roomKindAssignments = assignRoomKinds(dungeon.rooms, [
        { kind: "boss", count: getBossRoomCount(dungeon.rooms.length) },
        { kind: "swarm", count: getSwarmRoomCount(dungeon.rooms.length) },
      ]);

      this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

      const spriteProvider = new LocalSpriteProvider(config.asset_urls);
      const { player: playerManifest, enemy: enemyManifest, boss: bossManifest } = await this.loadEntityManifests(spriteProvider);

      const playerX = map.tileToWorldX(startRoom.centerX)!;
      const playerY = map.tileToWorldY(startRoom.centerY)!;
      const weapon = generateWeapon(randomWeaponCategory());
      this.player = new Player(this, playerX, playerY, weapon, playerManifest);
      this.cameras.main.startFollow(this.player.sprite, true);

      this.physics.add.collider(this.player.sprite, this.groundLayer);
      this.physics.add.collider(this.player.sprite, this.stuffLayer);

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

      // Player and Enemy implement CombatEntity themselves (live x/y getters), so both combat
      // systems take the entities directly.
      const spawner = new EnemySpawner();
      spawner.register("boss", spawnBossRoom);
      spawner.register("swarm", spawnSwarmRoom);
      const spawnResults = spawner.spawnAll(dungeon.rooms, roomKindAssignments, this.stuffLayer, {
        scene: this,
        map,
        config,
        enemyManifest,
        bossManifest,
        fontFamily,
        getPlayer: () => this.player,
        blocker,
      });
      this.enemyInstances = spawnResults.flatMap((result) => result.spawned);
      this.roomEncounters = spawnResults.map((result) => result.encounter);

      // Enemies collide with the same layers as the player (walls, structures, closed doors) and
      // each other, so a chasing swarm crowds around cover instead of stacking into a single
      // sprite - but not with the player itself, so a chasing enemy never physically blocks or
      // shoves the player around; combat (PlayerCombat/EnemyCombat) is what makes contact matter.
      const enemySprites = this.enemyInstances.map(({ enemy }) => enemy.sprite);
      enemySprites.forEach((sprite) => {
        this.physics.add.collider(sprite, this.groundLayer);
        this.physics.add.collider(sprite, this.stuffLayer);
      });
      if (enemySprites.length > 0) {
        this.physics.add.collider(enemySprites, enemySprites);
      }

      // The stairs room's own doors (distinct from a boss room's - those seal shut once the
      // player steps in and only reopen once that room's own enemies die, via RoomEncounter).
      // These start closed, the same closed-door tiles boss rooms use, and stay that way for the
      // whole level regardless of the player's position, until every boss in the dungeon is dead -
      // simply gating progress, not a trap the player can trigger.
      this.bossEncounters = spawnResults.filter((result) => result.kind === "boss").map((result) => result.encounter);
      this.finalRoomDoors = buildRoomDoors(this.stuffLayer, finalRoom);
      if (this.bossEncounters.length > 0) {
        this.finalRoomDoors.forEach((door) => door.close());
      }

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
        .text(100, 10, `${dungeon.rooms.length} rooms generated, ${spawnResults.length} special`, {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#e2e8f0",
          backgroundColor: "#0f172a",
          padding: { x: 6, y: 4 },
        })
        .setScrollFactor(0);

      // Level-start tutorial, sourced from the journal entry's own game_rules - freezes gameplay
      // (see the update() gate below) until the player has stepped through every line, so SPACE
      // advancing text can never also fire the player's SPACE-triggered basic attack.
      if (config.game_rules.length > 0) {
        this.tutorialBanner = new TutorialBanner(this, fontFamily, config.game_rules, () => {
          this.tutorialBanner = undefined;
        });
      }
    }

    update(_time: number, delta: number) {
      // create() resolves sprite manifests asynchronously; guard against Phaser calling update()
      // on an earlier frame before it has finished.
      if (!this.player) return;

      if (this.tutorialBanner) {
        this.tutorialBanner.update();
        return;
      }

      if (this.isPlayerDead || this.isLevelComplete) return;

      this.player.update(delta);
      // AI first so each enemy's update() sees the velocity chosen this frame when deriving its
      // animation state.
      this.enemyInstances.forEach(({ ai }) => ai.update(delta));
      this.enemyInstances.forEach(({ enemy }) => enemy.update(delta));
      this.enemyInstances.forEach(({ combat }) => combat.update(delta));
      this.playerCombat.update(delta);

      this.removeDeadEnemies();

      this.playerLabel.update();
      this.enemyInstances.forEach(({ label }) => label.update());

      const playerTileX = this.map.worldToTileX(this.player.x)!;
      const playerTileY = this.map.worldToTileY(this.player.y)!;
      this.roomEncounters.forEach((encounter) => encounter.update(playerTileX, playerTileY));

      // door.open() no-ops once already open, so it's fine to keep checking every frame rather
      // than tracking a separate "already opened" flag.
      if (this.bossEncounters.every((encounter) => encounter.isCleared)) {
        this.finalRoomDoors.forEach((door) => door.open());
      }

      if (this.rainSpawnZone) {
        rainFollowCamera(this, this.rainSpawnZone);
      }

      if (this.player.health.isDead) {
        this.handlePlayerDeath();
        return;
      }

      if (this.roomEncounters.every((encounter) => encounter.isCleared) && this.hasReachedStairs()) {
        this.handleLevelComplete();
      }
    }

    private hasReachedStairs(): boolean {
      const dx = this.player.x - this.stairsPosition.x;
      const dy = this.player.y - this.stairsPosition.y;
      return dx * dx + dy * dy < STAIRS_REACH_RADIUS * STAIRS_REACH_RADIUS;
    }

    private removeDeadEnemies() {
      const alive: SpawnedEnemy[] = [];
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
      this.enemyInstances.forEach(({ enemy }) => enemy.stop());
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
      this.enemyInstances.forEach(({ enemy }) => enemy.stop());
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
