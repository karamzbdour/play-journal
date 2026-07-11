export default class Health {
  private current: number;

  constructor(public readonly max: number) {
    this.current = max;
  }

  takeDamage(amount: number): void {
    this.current = Math.max(0, this.current - amount);
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  getRatio(): number {
    return this.current / this.max;
  }
}
