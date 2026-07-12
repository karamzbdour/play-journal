export interface RegenConfig {
  delayMs: number; // time since last damage before regen kicks in
  perSecond: number; // HP restored per second once regen is active
}

export default class Health {
  private current: number;
  private msSinceDamage = 0;

  constructor(public readonly max: number, private regen?: RegenConfig) {
    this.current = max;
  }

  takeDamage(amount: number): void {
    this.current = Math.max(0, this.current - amount);
    this.msSinceDamage = 0;
  }

  // No-op unless a regen config was passed in - enemies simply never call this or never get one.
  update(deltaMs: number): void {
    if (!this.regen || this.isDead || this.current >= this.max) return;

    const previousMsSinceDamage = this.msSinceDamage;
    this.msSinceDamage += deltaMs;
    if (this.msSinceDamage < this.regen.delayMs) return;

    // Only the portion of this tick past the delay threshold counts as regen time, so a large
    // deltaMs spike that straddles the threshold doesn't over-regen for the pre-threshold portion.
    const regenMs = this.msSinceDamage - Math.max(previousMsSinceDamage, this.regen.delayMs);
    this.current = Math.min(this.max, this.current + (this.regen.perSecond * regenMs) / 1000);
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  getRatio(): number {
    return this.current / this.max;
  }
}
