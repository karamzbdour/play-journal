import { ATTACKS, AttackDefinition } from "./Attack";
import StatusEffectController from "./StatusEffectController";

export interface CombatEntity {
  x: number;
  y: number;
  statusEffects: StatusEffectController;
}

export interface AggressiveCombatEntity extends CombatEntity {
  aggressionLevel: number;
}

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
  cooldowns: Map<string, number>
): AttackDefinition[] {
  return ATTACKS.filter(
    (attack) => attack.minAggression <= aggressionLevel && (cooldowns.get(attack.id) ?? 0) <= 0
  );
}

const defaultTrigger: AttackTrigger = (_enemy, _target, timeSinceLastAttempt) =>
  timeSinceLastAttempt >= DEFAULT_ATTACK_ATTEMPT_INTERVAL_MS;

const defaultSelector: AttackSelector = (_enemy, available) =>
  available.length === 0 ? null : available[Math.floor(Math.random() * available.length)];

export default class EnemyCombat {
  private cooldowns: Map<string, number> = new Map();
  private timeSinceLastAttempt = 0;
  private trigger: AttackTrigger;
  private selector: AttackSelector;

  constructor(
    private enemy: AggressiveCombatEntity,
    private getTarget: () => CombatEntity,
    options?: { trigger?: AttackTrigger; selector?: AttackSelector }
  ) {
    this.trigger = options?.trigger ?? defaultTrigger;
    this.selector = options?.selector ?? defaultSelector;
  }

  update(deltaMs: number): void {
    for (const [id, remaining] of this.cooldowns) {
      const next = remaining - deltaMs;
      if (next <= 0) this.cooldowns.delete(id);
      else this.cooldowns.set(id, next);
    }

    this.timeSinceLastAttempt += deltaMs;

    const target = this.getTarget();
    if (!this.trigger(this.enemy, target, this.timeSinceLastAttempt)) return;
    this.timeSinceLastAttempt = 0;

    const available = getAvailableAttacks(this.enemy.aggressionLevel, this.cooldowns);
    const chosen = this.selector(this.enemy, available);
    if (!chosen) return;

    this.cooldowns.set(chosen.id, chosen.cooldownMs);

    for (const application of chosen.effects) {
      const recipient = application.target === "self" ? this.enemy : target;
      recipient.statusEffects.apply(application.effectId, application.durationMs);
    }
  }
}
