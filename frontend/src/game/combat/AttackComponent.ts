import StatusEffectController from "./StatusEffectController";
import Health from "./Health";

export interface StatusEffectComponent {
  kind: "status";
  effectId: string;
  target: "self" | "target";
  durationMs: number;
}

export interface DamageComponent {
  kind: "damage";
  target: "self" | "target";
  amount?: number;
}

export type AttackComponent = StatusEffectComponent | DamageComponent;

export interface ResolvableEntity {
  statusEffects: StatusEffectController;
  health: Health;
}

export function resolveAttackComponents(
  components: AttackComponent[],
  self: ResolvableEntity,
  target: ResolvableEntity | null,
  fallbackDamage: number
): void {
  for (const component of components) {
    const recipient = component.target === "self" ? self : target;
    if (!recipient) continue;

    if (component.kind === "damage") {
      recipient.health.takeDamage(component.amount ?? fallbackDamage, recipient.statusEffects);
    } else {
      recipient.statusEffects.apply(component.effectId, component.durationMs);
    }
  }
}
