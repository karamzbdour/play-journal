import { prettifyName } from "@/lib/format";
import Enemy from "../entities/Enemy";
import EnemyCombat from "../combat/EnemyCombat";
import EntityLabel from "../ui/EntityLabel";
import { RoomSpawnStrategy } from "./EnemySpawner";

// Single placeholder boss, well above a regular enemy's HP and aggressive enough to reach every
// example attack (see combat/EnemyAttack.ts) over the course of the fight. Sprite comes from the
// same enemy manifest as regular enemies for now - swapping in a dedicated boss sprite from the
// database-backed SpriteProvider is a later step.
export const spawnBossRoom: RoomSpawnStrategy = ({ scene, map, room, config, enemyManifest, fontFamily, getPlayer, blocker }) => {
  const x = map.tileToWorldX(room.centerX)!;
  const y = map.tileToWorldY(room.centerY)!;

  const boss = new Enemy(scene, x, y, config.enemy_color, 3, 150, enemyManifest);
  boss.sprite.setScale(1.4);

  const label = new EntityLabel(scene, fontFamily, boss.sprite, {
    name: `Boss ${prettifyName(config.enemy_type)}`,
    statusEffects: boss.statusEffects,
    health: boss.health,
  });

  const combat = new EnemyCombat(boss, getPlayer, blocker, {
    onAttack: (attackId) => boss.animationController.play("attack", { abilityId: attackId }),
  });

  return [{ enemy: boss, combat, label }];
};
