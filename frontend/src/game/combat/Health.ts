import StatusEffectController from "./StatusEffectController";

export default class Health {
  private current: number;

  constructor(public readonly max: number) {
    this.current = max;
  }

  takeDamage(amount: number, statusEffects?: StatusEffectController): void {
    const blockMultiplier = statusEffects?.getMagnitude("block", 1) ?? 1;
    const effectiveDamage = Math.max(0, amount * blockMultiplier);
    this.current = Math.max(0, this.current - effectiveDamage);
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  getRatio(): number {
    return this.current / this.max;
  }
}
