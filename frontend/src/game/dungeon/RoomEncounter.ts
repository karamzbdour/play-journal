import Door from "./Door";

// Tile-coordinate rectangle, inclusive on all sides.
export interface TileBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface EncounterHealth {
  readonly isDead: boolean;
}

// Drives the doors guarding a special room (boss, swarm, ...). Doors start open. Once the player
// steps past them into the room's interior, they seal shut behind the player. They open again for
// good once every enemy spawned into the room dies - re-entering an already-cleared room never
// re-triggers the trap. A room spawned with zero enemies is considered cleared immediately
// (vacuously true), so it's never actually sealed - callers should always spawn at least one
// enemy for a real encounter.
export default class RoomEncounter {
  private triggered = false;
  private cleared = false;

  constructor(
    private readonly interior: TileBounds,
    private readonly doors: readonly Door[],
    private readonly enemies: readonly EncounterHealth[]
  ) {}

  get isCleared(): boolean {
    return this.cleared;
  }

  update(playerTileX: number, playerTileY: number): void {
    if (this.cleared) return;

    if (this.enemies.every((enemy) => enemy.isDead)) {
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
