import { CombatEntity } from "./EnemyCombat";
import { LineOfSightBlocker, hasLineOfSight } from "./lineOfSight";
import { Weapon } from "./Weapon";
import { WEAPON_ATTACKS } from "./WeaponAttack";
import { TILE_SIZE } from "../constants";

const BASIC_ATTACK_EFFECT_ID = "slow";
const BASIC_ATTACK_EFFECT_DURATION_MS = 500;

export interface AttackInput {
  isBasicAttackJustPressed(): boolean;
  isAbilityJustPressed(slot: 0 | 1 | 2): boolean;
}

function findNearestTarget(
  self: CombatEntity,
  enemies: CombatEntity[],
  maxRangeWorldUnits: number,
  blocker: LineOfSightBlocker
): CombatEntity | null {
  let nearest: CombatEntity | null = null;
  let nearestDistance = Infinity;

  for (const enemy of enemies) {
    const distance = Math.hypot(enemy.x - self.x, enemy.y - self.y);
    if (distance > maxRangeWorldUnits) continue;
    if (!hasLineOfSight(blocker, self.x, self.y, enemy.x, enemy.y)) continue;
    if (distance < nearestDistance) {
      nearest = enemy;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export default class PlayerCombat {
  private basicAttackCooldownMs = 0;
  private abilityCooldowns: Map<string, number> = new Map();

  constructor(
    private weapon: Weapon,
    private self: CombatEntity,
    private getEnemies: () => CombatEntity[],
    private blocker: LineOfSightBlocker,
    private input: AttackInput
  ) {}

  update(deltaMs: number): void {
    this.basicAttackCooldownMs = Math.max(0, this.basicAttackCooldownMs - deltaMs);
    for (const [id, remaining] of this.abilityCooldowns) {
      const next = remaining - deltaMs;
      if (next <= 0) this.abilityCooldowns.delete(id);
      else this.abilityCooldowns.set(id, next);
    }

    if (this.input.isBasicAttackJustPressed()) this.tryBasicAttack();
    for (const slot of [0, 1, 2] as const) {
      if (this.input.isAbilityJustPressed(slot)) this.tryAbility(slot);
    }
  }

  private tryBasicAttack(): void {
    if (this.basicAttackCooldownMs > 0) return;
    this.basicAttackCooldownMs = this.weapon.attackSpeedMs;

    const target = findNearestTarget(
      this.self,
      this.getEnemies(),
      this.weapon.rangeTiles * TILE_SIZE,
      this.blocker
    );
    if (!target) return;
    target.statusEffects.apply(BASIC_ATTACK_EFFECT_ID, BASIC_ATTACK_EFFECT_DURATION_MS);
  }

  private tryAbility(slot: 0 | 1 | 2): void {
    const attackId = this.weapon.attackIds[slot];
    if (!attackId) return;
    if ((this.abilityCooldowns.get(attackId) ?? 0) > 0) return;

    const definition = WEAPON_ATTACKS.find((a) => a.id === attackId);
    if (!definition) return;

    this.abilityCooldowns.set(attackId, definition.cooldownMs);

    const requiresTarget = definition.effects.some((application) => application.target === "target");
    const target = requiresTarget
      ? findNearestTarget(this.self, this.getEnemies(), this.weapon.rangeTiles * TILE_SIZE, this.blocker)
      : null;
    if (requiresTarget && !target) return;

    for (const application of definition.effects) {
      const recipient = application.target === "self" ? this.self : target!;
      recipient.statusEffects.apply(application.effectId, application.durationMs);
    }
  }
}
