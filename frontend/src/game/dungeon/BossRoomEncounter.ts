import Door from "./Door";

// Tile-coordinate rectangle, inclusive on all sides.
export interface TileBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BossHealth {
  readonly isDead: boolean;
}

// Drives the doors guarding a boss room. Doors start open. Once the player steps past them into
// the room's interior, they seal shut behind the player. They open again for good once the boss
// dies - re-entering an already-cleared room never re-triggers the trap.
export default class BossRoomEncounter {
  private triggered = false;
  private cleared = false;

  constructor(
    private readonly interior: TileBounds,
    private readonly doors: readonly Door[],
    private readonly boss: BossHealth
  ) {}

  get isCleared(): boolean {
    return this.cleared;
  }

  update(playerTileX: number, playerTileY: number): void {
    if (this.cleared) return;

    if (this.boss.isDead) {
      this.cleared = true;
      this.doors.forEach((door) => door.open());
      return;
    }

    if (!this.triggered && this.isInsideInterior(playerTileX, playerTileY)) {
      this.triggered = true;
      this.doors.forEach((door) => door.close());
    }
  }

  private isInsideInterior(tileX: number, tileY: number): boolean {
    return (
      tileX >= this.interior.left &&
      tileX <= this.interior.right &&
      tileY >= this.interior.top &&
      tileY <= this.interior.bottom
    );
  }
}
