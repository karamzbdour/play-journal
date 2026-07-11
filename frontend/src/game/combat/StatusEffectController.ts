import { STATUS_EFFECTS, StatusEffectDefinition } from "./StatusEffect";

interface ActiveEffect {
  def: StatusEffectDefinition;
  remainingMs: number;
  totalMs: number;
}

export default class StatusEffectController {
  private active: Map<string, ActiveEffect> = new Map();

  apply(effectId: string, durationMs: number): boolean {
    const def = STATUS_EFFECTS[effectId];
    if (!def) return false;

    for (const activeEffect of this.active.values()) {
      if (activeEffect.def.blocksTags?.some((tag) => def.tags.includes(tag))) {
        return false;
      }
    }

    this.active.set(effectId, { def, remainingMs: durationMs, totalMs: durationMs });
    return true;
  }

  has(effectId: string): boolean {
    return this.active.has(effectId);
  }

  getMagnitude(effectId: string, fallback = 1): number {
    const effect = this.active.get(effectId);
    return effect?.def.magnitude ?? fallback;
  }

  getRemainingRatio(effectId: string): number {
    const effect = this.active.get(effectId);
    if (!effect) return 0;
    return Math.max(0, Math.min(1, effect.remainingMs / effect.totalMs));
  }

  getActiveIds(): string[] {
    return Array.from(this.active.keys());
  }

  update(deltaMs: number): void {
    for (const [id, effect] of this.active) {
      effect.remainingMs -= deltaMs;
      if (effect.remainingMs <= 0) {
        this.active.delete(id);
      }
    }
  }
}
