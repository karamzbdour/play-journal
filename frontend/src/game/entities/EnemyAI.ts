import type Phaser from "phaser";
import Enemy from "./Enemy";
import { CombatEntity } from "../combat/CombatEntity";
import { LineOfSightBlocker, hasLineOfSight, isWithinRange } from "../combat/lineOfSight";
import { TILE_SIZE } from "../constants";

export interface EnemyAIOptions {
  /** World units per second. */
  speed?: number;
  /** How far away the enemy notices the target. */
  aggroRangeTiles?: number;
  /** Chase stops once this close, so the enemy crowds the target without jittering on top of it. */
  standoffTiles?: number;
}

const DEFAULT_SPEED = 170;
const DEFAULT_AGGRO_RANGE_TILES = 7;
const DEFAULT_STANDOFF_TILES = 1.25;

// Basic chase AI: move straight at the target whenever it's within aggro range AND visible, stop
// otherwise. Requiring line of sight every frame (the same blocker EnemyCombat uses to gate
// attacks) means breaking sight lines - ducking behind a room structure or around a wall - drops
// the chase, so cover actually works. Movement is velocity-only; the arcade colliders registered
// in DungeonScene handle sliding along walls and structures.
export default class EnemyAI {
  private readonly speed: number;
  private readonly aggroRange: number;
  private readonly standoff: number;

  constructor(
    private readonly enemy: Enemy,
    private readonly getTarget: () => CombatEntity,
    private readonly blocker: LineOfSightBlocker,
    options?: EnemyAIOptions
  ) {
    this.speed = options?.speed ?? DEFAULT_SPEED;
    this.aggroRange = (options?.aggroRangeTiles ?? DEFAULT_AGGRO_RANGE_TILES) * TILE_SIZE;
    this.standoff = (options?.standoffTiles ?? DEFAULT_STANDOFF_TILES) * TILE_SIZE;
  }

  update(_deltaMs: number): void {
    const body = this.enemy.sprite.body as Phaser.Physics.Arcade.Body;

    if (this.enemy.health.isDead) {
      body.setVelocity(0);
      return;
    }

    const target = this.getTarget();
    const dx = target.x - this.enemy.x;
    const dy = target.y - this.enemy.y;
    const distance = Math.hypot(dx, dy);

    const shouldChase =
      distance > this.standoff &&
      isWithinRange(this.enemy.x, this.enemy.y, target.x, target.y, this.aggroRange) &&
      hasLineOfSight(this.blocker, this.enemy.x, this.enemy.y, target.x, target.y);

    if (!shouldChase) {
      body.setVelocity(0);
      return;
    }

    // Same slow-status scaling the player's movement uses (see Player.update).
    const speed = this.speed * this.enemy.statusEffects.getMagnitude("slow", 1);
    body.setVelocity((dx / distance) * speed, (dy / distance) * speed);
  }
}
