import { describe, it, expect, vi } from "vitest";
import type Phaser from "phaser";
import EnemySpawner, { RoomSpawnContext, SpawnedEnemy } from "@/game/dungeon/EnemySpawner";
import { RoomKind } from "@/game/dungeon/RoomKind";
import { DungeonRoom } from "@/game/dungeon/DungeonRoom";
import Health from "@/game/combat/Health";
import type Enemy from "@/game/entities/Enemy";
import type EnemyCombat from "@/game/combat/EnemyCombat";
import type EntityLabel from "@/game/ui/EntityLabel";

function fakeRoom(doors: { x: number; y: number }[] = []): DungeonRoom {
  return {
    x: 0,
    y: 0,
    width: 7,
    height: 7,
    left: 1,
    right: 5,
    top: 1,
    bottom: 5,
    getDoorLocations: () => doors,
  } as unknown as DungeonRoom;
}

function fakeStuffLayer(): Phaser.Tilemaps.TilemapLayer {
  return { putTileAt: vi.fn(), removeTileAt: vi.fn() } as unknown as Phaser.Tilemaps.TilemapLayer;
}

function baseCtx(): Omit<RoomSpawnContext, "room"> {
  return {
    scene: {} as unknown as Phaser.Scene,
    map: {} as unknown as Phaser.Tilemaps.Tilemap,
    config: {} as unknown as RoomSpawnContext["config"],
    enemyManifest: {} as unknown as RoomSpawnContext["enemyManifest"],
    bossManifest: {} as unknown as RoomSpawnContext["bossManifest"],
    fontFamily: "monospace",
    getPlayer: () => ({ x: 0, y: 0 }) as unknown as ReturnType<RoomSpawnContext["getPlayer"]>,
    blocker: { isBlocked: () => false },
  };
}

function fakeSpawnedEnemy(): SpawnedEnemy {
  const health = new Health(10);
  return {
    enemy: { health } as unknown as Enemy,
    combat: {} as unknown as EnemyCombat,
    label: {} as unknown as EntityLabel,
  };
}

describe("EnemySpawner", () => {
  it("skips rooms with no kind assignment", () => {
    const spawner = new EnemySpawner();
    const strategy = vi.fn(() => [fakeSpawnedEnemy()]);
    spawner.register("boss", strategy);

    const results = spawner.spawnAll([fakeRoom()], new Map(), fakeStuffLayer(), baseCtx());

    expect(results).toHaveLength(0);
    expect(strategy).not.toHaveBeenCalled();
  });

  it("skips rooms whose assigned kind has no registered strategy", () => {
    const spawner = new EnemySpawner();
    const room = fakeRoom();
    const assignments = new Map<DungeonRoom, RoomKind>([[room, "boss"]]);

    const results = spawner.spawnAll([room], assignments, fakeStuffLayer(), baseCtx());

    expect(results).toHaveLength(0);
  });

  it("invokes the registered strategy for an assigned room and returns its spawned enemies", () => {
    const spawner = new EnemySpawner();
    const spawned = [fakeSpawnedEnemy()];
    const strategy = vi.fn(() => spawned);
    spawner.register("boss", strategy);

    const room = fakeRoom();
    const assignments = new Map<DungeonRoom, RoomKind>([[room, "boss"]]);
    const ctx = baseCtx();
    const results = spawner.spawnAll([room], assignments, fakeStuffLayer(), ctx);

    expect(strategy).toHaveBeenCalledWith({ ...ctx, room });
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("boss");
    expect(results[0].spawned).toBe(spawned);
  });

  it("builds an encounter that clears once every enemy the strategy spawned is dead", () => {
    const spawner = new EnemySpawner();
    const first = fakeSpawnedEnemy();
    const second = fakeSpawnedEnemy();
    spawner.register("boss", () => [first, second]);

    const room = fakeRoom();
    const assignments = new Map<DungeonRoom, RoomKind>([[room, "boss"]]);
    const results = spawner.spawnAll([room], assignments, fakeStuffLayer(), baseCtx());

    const encounter = results[0].encounter;
    expect(encounter.isCleared).toBe(false);

    first.enemy.health.takeDamage(999);
    second.enemy.health.takeDamage(999);
    encounter.update(0, 0);

    expect(encounter.isCleared).toBe(true);
  });

  it("processes multiple assigned rooms independently", () => {
    const spawner = new EnemySpawner();
    const strategy = vi.fn(() => [fakeSpawnedEnemy()]);
    spawner.register("boss", strategy);

    const roomA = fakeRoom();
    const roomB = fakeRoom();
    const assignments = new Map<DungeonRoom, RoomKind>([
      [roomA, "boss"],
      [roomB, "boss"],
    ]);
    const results = spawner.spawnAll([roomA, roomB], assignments, fakeStuffLayer(), baseCtx());

    expect(results).toHaveLength(2);
    expect(strategy).toHaveBeenCalledTimes(2);
  });
});
