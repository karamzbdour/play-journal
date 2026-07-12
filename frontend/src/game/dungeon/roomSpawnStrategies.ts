import type Phaser from "phaser";
import { prettifyName } from "@/lib/format";
import Enemy from "../entities/Enemy";
import EnemyAI from "../entities/EnemyAI";
import EnemyCombat from "../combat/EnemyCombat";
import EntityLabel from "../ui/EntityLabel";
import { RoomSpawnStrategy, SpawnedEnemy } from "./EnemySpawner";
import { DungeonRoom } from "./DungeonRoom";

const SWARM_MIN_ENEMIES = 3;
const SWARM_MAX_ENEMIES = 6;
const SWARM_ENEMY_HP = 30;
// Spawn tiles stay 2 tiles clear of the walls so an enemy can never sit right on top of the tile
// the player steps through when entering the room (doors are punched into the walls themselves).
const SPAWN_WALL_MARGIN = 2;
const SPAWN_ATTEMPTS = 30;

// Random interior tile with a wall margin, skipping tiles already holding stuff (structures,
// stairs) or already used by an earlier pick. Returns null when the room is too cluttered/small
// to find one - callers just spawn fewer enemies then.
function pickSpawnTile(
  room: DungeonRoom,
  stuffLayer: Phaser.Tilemaps.TilemapLayer,
  used: Set<string>
): { x: number; y: number } | null {
  const minX = room.left + SPAWN_WALL_MARGIN;
  const maxX = room.right - SPAWN_WALL_MARGIN;
  const minY = room.top + SPAWN_WALL_MARGIN;
  const maxY = room.bottom - SPAWN_WALL_MARGIN;
  if (minX > maxX || minY > maxY) return null;

  for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
    const x = minX + Math.floor(Math.random() * (maxX - minX + 1));
    const y = minY + Math.floor(Math.random() * (maxY - minY + 1));
    const key = `${x},${y}`;
    if (used.has(key) || stuffLayer.getTileAt(x, y)) continue;
    used.add(key);
    return { x, y };
  }
  return null;
}

// Single placeholder boss, well above a regular enemy's HP and aggressive enough to reach every
// example attack (see combat/EnemyAttack.ts) over the course of the fight. Sprite comes from
// bossManifest, which prefers a "boss"-typed asset over the regular enemy one (see
// SpriteProvider's BOSS_SPRITE_ID handling) so the boss actually looks distinct when the journal's
// matched assets include one.
export const spawnBossRoom: RoomSpawnStrategy = ({ scene, map, room, config, bossManifest, fontFamily, getPlayer, blocker }) => {
  const x = map.tileToWorldX(room.centerX)!;
  const y = map.tileToWorldY(room.centerY)!;

  const boss = new Enemy(scene, x, y, config.enemy_color, 3, 150, bossManifest);
  boss.sprite.setScale(1.4);

  const label = new EntityLabel(scene, fontFamily, boss.sprite, {
    name: config.bosses[0] ?? `Boss ${prettifyName(config.enemy_type)}`,
    statusEffects: boss.statusEffects,
    health: boss.health,
  });

  // Slower than swarm enemies but sees further - a lumbering threat that's hard to fully escape
  // inside its own sealed room.
  const ai = new EnemyAI(boss, getPlayer, blocker, { speed: 140, aggroRangeTiles: 9 });

  const combat = new EnemyCombat(boss, getPlayer, blocker, {
    onAttack: (attackId) => boss.animationController.play("attack", { abilityId: attackId }),
  });

  return [{ enemy: boss, ai, combat, label }];
};

// 3-6 weak, fast enemies scattered across the room. Uses the regular enemy manifest and the same
// door-sealing mechanic as boss rooms (RoomEncounter, via EnemySpawner) - the room seals when the
// player steps in and reopens once the whole swarm is dead.
export const spawnSwarmRoom: RoomSpawnStrategy = ({ scene, map, room, config, enemyManifest, stuffLayer, fontFamily, getPlayer, blocker }) => {
  const count = SWARM_MIN_ENEMIES + Math.floor(Math.random() * (SWARM_MAX_ENEMIES - SWARM_MIN_ENEMIES + 1));
  const used = new Set<string>();
  const spawned: SpawnedEnemy[] = [];

  for (let i = 0; i < count; i++) {
    // Fall back to the room center for the first enemy so a cluttered room still gets a real
    // encounter - a zero-enemy room would count as instantly cleared (see RoomEncounter).
    const tile = pickSpawnTile(room, stuffLayer, used) ?? (i === 0 ? { x: room.centerX, y: room.centerY } : null);
    if (!tile) continue;

    const x = map.tileToWorldX(tile.x)!;
    const y = map.tileToWorldY(tile.y)!;

    const aggressionLevel = 1 + Math.floor(Math.random() * 2);
    const enemy = new Enemy(scene, x, y, config.enemy_color, aggressionLevel, SWARM_ENEMY_HP, enemyManifest);

    const label = new EntityLabel(scene, fontFamily, enemy.sprite, {
      name: prettifyName(config.enemy_type),
      statusEffects: enemy.statusEffects,
      health: enemy.health,
    });

    const ai = new EnemyAI(enemy, getPlayer, blocker, { speed: 200 });

    const combat = new EnemyCombat(enemy, getPlayer, blocker, {
      onAttack: (attackId) => enemy.animationController.play("attack", { abilityId: attackId }),
    });

    spawned.push({ enemy, ai, combat, label });
  }

  return spawned;
};
