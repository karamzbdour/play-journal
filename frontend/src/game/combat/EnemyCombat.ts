import { ATTACKS, AttackDefinition } from "./EnemyAttack";
import { CombatEntity, AggressiveCombatEntity } from "./CombatEntity";
import { resolveAttackComponents } from "./AttackComponent";
import CooldownTracker from "./CooldownTracker";
import { LineOfSightBlocker, isWithinRange, hasLineOfSight } from "./lineOfSight";
import { TILE_SIZE } from "../constants";

export type AttackSelector = (
  enemy: AggressiveCombatEntity,
  available: AttackDefinition[]
) => AttackDefinition | null;

export type AttackTrigger = (
  enemy: AggressiveCombatEntity,
  target: CombatEntity,
  timeSinceLastAttempt: number
) => boolean;

const DEFAULT_ATTACK_ATTEMPT_INTERVAL_MS = 1500;

export function getAvailableAttacks(
  aggressionLevel: number,
  isReady: (attackId: string) => boolean
): AttackDefinition[] {
  return ATTACKS.filter((attack) => attack.minAggression <= aggressionLevel && isReady(attack.id));
}

const defaultTrigger: AttackTrigger = (_enemy, _target, timeSinceLastAttempt) =>
  timeSinceLastAttempt >= DEFAULT_ATTACK_ATTEMPT_INTERVAL_MS;

const defaultSelector: AttackSelector = (_enemy, available) =>
  available.length === 0 ? null : available[Math.floor(Math.random() * available.length)];

export default class EnemyCombat {
  private cooldowns = new CooldownTracker();
  private timeSinceLastAttempt = 0;
  private trigger: AttackTrigger;
  private selector: AttackSelector;
  private onAttack?: (attackId: string) => void;

  constructor(
    private enemy: AggressiveCombatEntity,
    private getTarget: () => CombatEntity,
    private blocker: LineOfSightBlocker,
    options?: { trigger?: AttackTrigger; selector?: AttackSelector; onAttack?: (attackId: string) => void }
  ) {
    this.trigger = options?.trigger ?? defaultTrigger;
    this.selector = options?.selector ?? defaultSelector;
    this.onAttack = options?.onAttack;
  }

  update(deltaMs: number): void {
    this.cooldowns.tick(deltaMs);
    this.timeSinceLastAttempt += deltaMs;

    const target = this.getTarget();
    if (!this.trigger(this.enemy, target, this.timeSinceLastAttempt)) return;
    this.timeSinceLastAttempt = 0;

    const byAggressionAndCooldown = getAvailableAttacks(this.enemy.aggressionLevel, (id) =>
      this.cooldowns.isReady(id)
    );
    const available = byAggressionAndCooldown.filter((attack) => {
      if (
        attack.maxRangeTiles !== undefined &&
        !isWithinRange(this.enemy.x, this.enemy.y, target.x, target.y, attack.maxRangeTiles * TILE_SIZE)
      ) {
        return false;
      }
      if (
        attack.requiresLineOfSight &&
        !hasLineOfSight(this.blocker, this.enemy.x, this.enemy.y, target.x, target.y)
      ) {
        return false;
      }
      return true;
    });

    const chosen = this.selector(this.enemy, available);
    if (!chosen) return;

    this.cooldowns.start(chosen.id, chosen.cooldownMs);
    resolveAttackComponents(chosen.effects, this.enemy, target, 0);
    this.onAttack?.(chosen.id);
  }
}
