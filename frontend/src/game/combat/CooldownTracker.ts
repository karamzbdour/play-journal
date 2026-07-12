// Counts down named cooldowns. Shared by PlayerCombat (basic attack +
// abilities) and EnemyCombat (attack cooldowns) so neither hand-rolls the
// same decrement-and-expire map loop.
export default class CooldownTracker {
  private remaining: Map<string, number> = new Map();

  tick(deltaMs: number): void {
    for (const [id, ms] of this.remaining) {
      const next = ms - deltaMs;
      if (next <= 0) this.remaining.delete(id);
      else this.remaining.set(id, next);
    }
  }

  start(id: string, durationMs: number): void {
    if (durationMs <= 0) return;
    this.remaining.set(id, durationMs);
  }

  isReady(id: string): boolean {
    return !this.remaining.has(id);
  }
}
