import { STATUS_EFFECTS, StatusEffectDefinition } from "./StatusEffect";

interface ActiveEffect {
  def: StatusEffectDefinition;
  remainingMs: number;
  totalMs: number;
  tickAccumulatorMs: number;
}

export default class StatusEffectController {
  private active: Map<string, ActiveEffect> = new Map();
  private damageTickHandler?: (damageAmount: number) => void;

  constructor(damageTickHandler?: (damageAmount: number) => void) {
    this.damageTickHandler = damageTickHandler;
  }

  apply(effectId: string, durationMs: number): boolean {
    const def = STATUS_EFFECTS[effectId];
    if (!def) return false;

    for (const activeEffect of this.active.values()) {
      if (activeEffect.def.blocksTags?.some((tag) => def.tags.includes(tag))) {
        return false;
      }
    }

    this.active.set(effectId, { def, remainingMs: durationMs, totalMs: durationMs, tickAccumulatorMs: 0 });
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

      if (effect.def.id === "poison") {
        effect.tickAccumulatorMs += deltaMs;
        const tickIntervalMs = 1000;
        while (effect.tickAccumulatorMs >= tickIntervalMs) {
          effect.tickAccumulatorMs -= tickIntervalMs;
          if (effect.def.magnitude && effect.def.magnitude > 0 && this.damageTickHandler) {
            const damageAmount = Math.max(1, Math.round(100 * effect.def.magnitude));
            this.damageTickHandler(damageAmount);
          }
        }
      }

      if (effect.remainingMs <= 0) {
        this.active.delete(id);
      }
    }
  }
}
