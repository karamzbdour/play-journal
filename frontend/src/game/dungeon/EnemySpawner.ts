import type Phaser from "phaser";
import { GameConfig } from "@/types/game";
import { SpriteManifest } from "../animation/SpriteManifest";
import { CombatEntity } from "../combat/CombatEntity";
import { LineOfSightBlocker } from "../combat/lineOfSight";
import EnemyCombat from "../combat/EnemyCombat";
import EntityLabel from "../ui/EntityLabel";
import Enemy from "../entities/Enemy";
import EnemyAI from "../entities/EnemyAI";
import { DungeonRoom } from "./DungeonRoom";
import { RoomKind } from "./RoomKind";
import RoomEncounter, { TileBounds } from "./RoomEncounter";
import buildRoomDoors from "./buildRoomDoors";

export interface SpawnedEnemy {
  enemy: Enemy;
  ai: EnemyAI;
  combat: EnemyCombat;
  label: EntityLabel;
}

export interface RoomSpawnResult {
  room: DungeonRoom;
  kind: RoomKind;
  spawned: SpawnedEnemy[];
  encounter: RoomEncounter;
}

// Everything a per-kind spawn strategy needs to populate its room. Strategies only decide what
// enemies to create - door sealing and clear detection are handled uniformly by EnemySpawner via
// RoomEncounter, so a strategy never has to know about doors or tile bounds.
export interface RoomSpawnContext {
  scene: Phaser.Scene;
  map: Phaser.Tilemaps.Tilemap;
  room: DungeonRoom;
  // For checking which tiles are already occupied (structures, stairs) when picking spawn spots.
  stuffLayer: Phaser.Tilemaps.TilemapLayer;
  config: GameConfig;
  enemyManifest: SpriteManifest;
  bossManifest: SpriteManifest;
  fontFamily: string;
  getPlayer: () => CombatEntity;
  blocker: LineOfSightBlocker;
}

export type RoomSpawnStrategy = (ctx: RoomSpawnContext) => SpawnedEnemy[];

// Loops every room in a dungeon and, for the ones assigned a special kind (see assignRoomKinds),
// runs that kind's registered strategy and seals the room behind doors until every enemy it
// spawned is dead. Rooms with no assignment, or a kind with no registered strategy, are left
// untouched. Register strategies via `.register(kind, strategy)` before calling spawnAll.
export default class EnemySpawner {
  private strategies = new Map<RoomKind, RoomSpawnStrategy>();

  register(kind: RoomKind, strategy: RoomSpawnStrategy): void {
    this.strategies.set(kind, strategy);
  }

  spawnAll(
    rooms: readonly DungeonRoom[],
    assignments: ReadonlyMap<DungeonRoom, RoomKind>,
    stuffLayer: Phaser.Tilemaps.TilemapLayer,
    ctx: Omit<RoomSpawnContext, "room" | "stuffLayer">
  ): RoomSpawnResult[] {
    const results: RoomSpawnResult[] = [];

    for (const room of rooms) {
      const kind = assignments.get(room);
      if (!kind) continue;

      const strategy = this.strategies.get(kind);
      if (!strategy) continue;

      const spawned = strategy({ ...ctx, room, stuffLayer });

      const doors = buildRoomDoors(stuffLayer, room);
      const interior: TileBounds = {
        left: room.left + 1,
        right: room.right - 1,
        top: room.top + 1,
        bottom: room.bottom - 1,
      };
      const encounter = new RoomEncounter(interior, doors, spawned.map(({ enemy }) => enemy.health));

      results.push({ room, kind, spawned, encounter });
    }

    return results;
  }
}
